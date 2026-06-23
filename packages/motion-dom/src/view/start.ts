import { secondsToMilliseconds } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import { NativeAnimation } from "../animation/NativeAnimation"
import { NativeAnimationWrapper } from "../animation/NativeAnimationWrapper"
import { AnimationPlaybackControls } from "../animation/types"
import { getValueTransition } from "../animation/utils/get-value-transition"
import { mapEasingToNativeEasing } from "../animation/waapi/easing/map-easing"
import { applyGeneratorOptions } from "../animation/waapi/utils/apply-generator"
import { ElementOrSelector } from "../utils/resolve-elements"
import type { ViewTransitionBuilder } from "./index"
import { ViewTransitionTarget, ViewTransitionTargetDefinition } from "./types"
import {
    assignViewTransitionNames,
    releaseViewTransitionNames,
} from "./utils/assign-names"
import { chooseLayerType } from "./utils/choose-layer-type"
import { css } from "./utils/css"
import { getViewAnimationLayerInfo } from "./utils/get-layer-info"
import { getViewAnimations } from "./utils/get-view-animations"
import { hasTarget } from "./utils/has-target"

const definitionNames = ["layout", "enter", "exit"] as const

/**
 * Maps a browser-generated layer type to the `ViewTransitionTarget` bucket that
 * times/overrides it - the inverse of `chooseLayerType`. `group-children` and
 * `image-pair` have no bucket; they follow the default layout timing.
 */
const layerBuckets: Record<string, keyof ViewTransitionTarget> = {
    group: "layout",
    new: "enter",
    old: "exit",
}

const cornerProps = [
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
] as const

type CornerRadii = Record<(typeof cornerProps)[number], string>

export function startViewAnimation(
    builder: ViewTransitionBuilder
): Promise<GroupAnimation> {
    const {
        update,
        targets,
        resolveDefs,
        noCrop,
        pairs,
        options: defaultOptions,
    } = builder

    if (!document.startViewTransition) {
        // An async IIFE (not `new Promise(async …)`) so a throwing/rejecting
        // update rejects this promise rather than leaving it unsettled.
        return (async () => {
            await update()
            return new GroupAnimation([])
        })()
    }

    /**
     * Resolve any selector/Element targets to layer names, assigning a
     * `view-transition-name` to each element as we go. We run this before the
     * update (so the elements are captured in the old snapshot) and again
     * after it (for the new snapshot). An element present in both keeps the
     * same name and animates as a single `group` layer.
     */
    const nameRegistry = new Map<Element, string>()
    const assigned: Element[] = []
    const layerTargets = new Map<string, ViewTransitionTarget>()
    const croppedNames = new Set<string>()
    /**
     * Each layer's stagger position (index + total) within its subject, per
     * snapshot. Resolving against the snapshot the layer belongs to keeps
     * stagger correct when `update()` replaces the matched elements, and lets
     * us skip a layer that's absent from a snapshot (e.g. an exited element
     * has no `new` pseudo-element).
     */
    const layerStagger = new Map<
        string,
        { old?: [number, number]; new?: [number, number] }
    >()
    /**
     * Names allocated for a paired subject in the old snapshot, replayed onto
     * its new-snapshot target so both ends share a layer and morph.
     */
    const pairNames = new Map<ViewTransitionTargetDefinition, string[]>()

    const resolveLayers = (phase: "old" | "new") => {
        targets.forEach((target, definition) => {
            let names: string[]
            if (definition === "root" || !resolveDefs.has(definition)) {
                names = [definition as string]
            } else if (pairs.has(definition)) {
                /**
                 * Paired morph: name the old target in the old snapshot, then
                 * force the same name(s) onto the new target in the new one, so
                 * two different elements morph as a single layer.
                 */
                if (phase === "old") {
                    names = assignViewTransitionNames(
                        definition as ElementOrSelector,
                        nameRegistry,
                        assigned
                    )
                    pairNames.set(definition, names)
                } else {
                    names = assignViewTransitionNames(
                        pairs.get(definition) as ElementOrSelector,
                        nameRegistry,
                        assigned,
                        pairNames.get(definition)
                    )
                }
            } else {
                names = assignViewTransitionNames(
                    definition as ElementOrSelector,
                    nameRegistry,
                    assigned
                )
            }

            const cropped = definition !== "root" && !noCrop.has(definition)

            names.forEach((name, index) => {
                /**
                 * If two subjects resolve to the same element, merge their
                 * definitions so neither subject's animations are dropped.
                 */
                const existing = layerTargets.get(name)
                layerTargets.set(
                    name,
                    existing && existing !== target
                        ? { ...existing, ...target }
                        : target
                )

                if (cropped) croppedNames.add(name)

                const stagger = layerStagger.get(name) ?? {}
                stagger[phase] = [index, names.length]
                layerStagger.set(name, stagger)
            })
        })
    }

    /**
     * The stagger index/total for a layer, resolved against the snapshot it
     * belongs to. Returns index -1 when the layer is absent from that snapshot
     * so the caller can skip a pseudo-element that doesn't exist.
     */
    const staggerPosition = (name: string, type: string) => {
        const stagger = layerStagger.get(name)
        const position =
            type === "old"
                ? stagger?.old
                : type === "new"
                  ? stagger?.new
                  : // group / group-children / image-pair persist across both.
                    stagger?.new ?? stagger?.old
        return position ?? ([-1, 1] as const)
    }

    /**
     * Merge default + per-layer transition options for a generated layer and
     * resolve any stagger/delay function against this element's position. Used
     * by both the morph-retiming and crop corner-radius passes.
     */
    const resolveLayerTransition = (
        target: ViewTransitionTarget | undefined,
        type: string,
        transitionName: string,
        index: number,
        total: number
    ) => {
        const transition = {
            ...getValueTransition(defaultOptions, transitionName),
            ...getValueTransition(
                (layerOptions(target, type) ?? {}) as any,
                transitionName
            ),
        }

        if (typeof transition.delay === "function") {
            transition.delay = transition.delay(index, total)
        }

        return transition
    }

    /**
     * Measured corner radii per cropped layer, so the clip can animate each
     * corner between the old and new elements. Per-corner (rather than the
     * shorthand) so mismatched/individual radii interpolate cleanly.
     */
    const cropRadii = new Map<string, { old?: CornerRadii; new?: CornerRadii }>()

    const recordRadii = (
        style: CSSStyleDeclaration,
        name: string,
        phase: "old" | "new"
    ) => {
        const corners = {} as CornerRadii
        for (const corner of cornerProps) corners[corner] = style[corner]

        const entry = cropRadii.get(name) ?? {}
        entry[phase] = corners
        cropRadii.set(name, entry)
    }

    /**
     * Cropped layers all come from `.add()`, so their elements are in the
     * registry - read each one's corner radii directly. For a paired morph both
     * ends share a name; the new-snapshot element is registered last, so it
     * wins the `new` reading (and the old end the `old` reading).
     */
    const measureCrop = (phase: "old" | "new") => {
        if (!croppedNames.size) return

        nameRegistry.forEach((name, element) => {
            if (croppedNames.has(name)) {
                recordRadii(getComputedStyle(element), name, phase)
            }
        })
    }

    resolveLayers("old")
    measureCrop("old")

    /**
     * If we don't have any animations defined for the root target,
     * remove it from being captured.
     */
    if (!hasTarget("root", targets)) {
        css.set(":root", {
            "view-transition-name": "none",
        })
    }

    /**
     * Set the timing curve to linear for all view transition layers.
     * This gets baked into the keyframes, which can't be changed
     * without breaking the generated animation.
     *
     * This allows us to set easing via updateTiming - which can be changed.
     */
    css.set(
        "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)",
        { "animation-timing-function": "linear !important" }
    )

    /**
     * Morphs are clipped + object-fit: cover by default (the UA default
     * overflows on aspect-ratio change), with an animated border-radius added
     * below. `.crop(false)` opts a subject out. Names from the first resolve
     * pass are known here.
     */
    croppedNames.forEach((name) => {
        css.set(`::view-transition-group(${name})`, {
            overflow: "clip",
        })
        css.set(
            `::view-transition-old(${name}), ::view-transition-new(${name})`,
            { width: "100%", height: "100%", "object-fit": "cover" }
        )
    })

    css.commit() // Write

    const callback = async () => {
        await update()

        /**
         * Re-resolve so elements created by the update are named for the new
         * snapshot, then measure the cropped layers' new border-radius.
         */
        resolveLayers("new")
        measureCrop("new")
    }

    const transition = document.startViewTransition(callback)

    transition.finished.finally(() => {
        releaseViewTransitionNames(assigned)
        css.remove() // Write
    })

    return new Promise<GroupAnimation>((resolve, reject) => {
        transition.ready
            .then(() => {
                const generatedViewAnimations = getViewAnimations()

                const animations: AnimationPlaybackControls[] = []

                /**
                 * Create animations for each of our explicitly-defined subjects.
                 */
                layerTargets.forEach((target, name) => {
                    for (const key of definitionNames) {
                        if (!target[key]) continue

                        const type = chooseLayerType(
                            key as keyof ViewTransitionTarget
                        )
                        const [index, total] = staggerPosition(name, type)
                        // Skip a layer absent from its snapshot.
                        if (index === -1) continue

                        const { keyframes, options } =
                            target[key as keyof ViewTransitionTarget]!

                        for (let [valueName, valueKeyframes] of Object.entries(
                            keyframes
                        )) {
                            // Skip only missing values - `0` (e.g. opacity: 0)
                            // is valid and must reach the from-value inference.
                            if (valueKeyframes == null) continue

                            const valueOptions = {
                                ...getValueTransition(
                                    defaultOptions as any,
                                    valueName
                                ),
                                ...getValueTransition(options as any, valueName),
                            }

                            /**
                             * If this is an opacity animation, and keyframes are not an array,
                             * we need to convert them into an array and set an initial value.
                             */
                            if (
                                valueName === "opacity" &&
                                !Array.isArray(valueKeyframes)
                            ) {
                                const initialValue = type === "new" ? 0 : 1
                                valueKeyframes = [initialValue, valueKeyframes]
                            }

                            /**
                             * Resolve stagger function if provided, per element
                             * across this subject's resolved layers.
                             */
                            if (typeof valueOptions.delay === "function") {
                                valueOptions.delay = valueOptions.delay(
                                    index,
                                    total
                                )
                            }

                            valueOptions.duration &&= secondsToMilliseconds(
                                valueOptions.duration
                            )

                            valueOptions.delay &&= secondsToMilliseconds(
                                valueOptions.delay
                            )

                            animations.push(
                                new NativeAnimation({
                                    ...valueOptions,
                                    element: document.documentElement,
                                    name: valueName,
                                    pseudoElement: `::view-transition-${type}(${name})`,
                                    keyframes: valueKeyframes,
                                })
                            )
                        }
                    }
                })

                /**
                 * Handle browser generated animations
                 */
                for (const animation of generatedViewAnimations) {
                    if (animation.playState === "finished") continue

                    const { effect } = animation
                    if (!effect || !(effect instanceof KeyframeEffect)) continue

                    const { pseudoElement } = effect
                    if (!pseudoElement) continue

                    const name = getViewAnimationLayerInfo(pseudoElement)
                    if (!name) continue

                    const targetDefinition = layerTargets.get(name.layer)

                    /**
                     * If we've built an explicit animation for this layer, drop
                     * the browser-generated one. A `.crossfade()` is handled
                     * this way too: our explicit old/new opacity animations run
                     * under the browser's static `mix-blend-mode: plus-lighter`
                     * (cancelling removes the generated animation, not the
                     * static blend), so crossfade quality is preserved.
                     */
                    if (
                        targetDefinition &&
                        hasExplicitKeyframes(targetDefinition, name.type)
                    ) {
                        animation.cancel()
                        continue
                    }

                    /**
                     * Otherwise retime the browser-generated animation to
                     * Motion's timing. This auto-enables the layout (group)
                     * morph for any resolved/named target, and applies the
                     * default timing to old/new layers we haven't explicitly
                     * overridden.
                     *
                     * group + group-children both follow the layout timing so
                     * the nesting container stays in sync with the morph.
                     */
                    const [index, total] = staggerPosition(
                        name.layer,
                        name.type
                    )
                    const transitionName = name.type.startsWith("group")
                        ? "layout"
                        : ""
                    let animationTransition = resolveLayerTransition(
                        targetDefinition,
                        name.type,
                        transitionName,
                        index === -1 ? 0 : index,
                        total
                    )

                    animationTransition.duration &&= secondsToMilliseconds(
                        animationTransition.duration
                    )

                    animationTransition =
                        applyGeneratorOptions(animationTransition)

                    const easing = mapEasingToNativeEasing(
                        animationTransition.ease,
                        animationTransition.duration!
                    ) as string

                    effect.updateTiming({
                        delay: secondsToMilliseconds(
                            animationTransition.delay ?? 0
                        ),
                        duration: animationTransition.duration,
                        easing,
                    })

                    animations.push(new NativeAnimationWrapper(animation))
                }

                /**
                 * Animate each cropped layer's clip corners between the old and
                 * new elements, so a cropped morph keeps rounded corners
                 * (handling individual per-corner radii).
                 */
                cropRadii.forEach((radii, name) => {
                    if (!radii.old && !radii.new) return

                    const target = layerTargets.get(name)
                    const [index, total] = staggerPosition(name, "group")
                    const radiusOptions = resolveLayerTransition(
                        target,
                        "group",
                        "layout",
                        index === -1 ? 0 : index,
                        total
                    )

                    radiusOptions.duration &&= secondsToMilliseconds(
                        radiusOptions.duration
                    )
                    radiusOptions.delay &&= secondsToMilliseconds(
                        radiusOptions.delay
                    )

                    for (const corner of cornerProps) {
                        // `||` (not `??`) so an empty measurement (e.g. an
                        // un-rendered element) falls back rather than producing
                        // an invalid keyframe.
                        const from =
                            radii.old?.[corner] || radii.new?.[corner] || "0px"
                        const to =
                            radii.new?.[corner] || radii.old?.[corner] || "0px"
                        // Skip square corners - nothing to round.
                        if (parseFloat(from) === 0 && parseFloat(to) === 0) {
                            continue
                        }

                        animations.push(
                            new NativeAnimation({
                                ...radiusOptions,
                                element: document.documentElement,
                                name: corner,
                                pseudoElement: `::view-transition-group(${name})`,
                                keyframes: [from, to],
                            })
                        )
                    }
                })

                resolve(new GroupAnimation(animations))
            })
            // A skipped transition rejects `ready`; propagate so the queue can
            // advance rather than hanging on a promise that never settles.
            .catch(reject)
    })
}

/**
 * Whether the user defined explicit keyframes for a given generated layer
 * type, in which case we replace the browser's animation with our own.
 */
function hasExplicitKeyframes(target: ViewTransitionTarget, type: string) {
    const keyframes = target[layerBuckets[type]]?.keyframes
    return keyframes != null && Object.keys(keyframes).length > 0
}

/**
 * The options that should time a given generated layer type, so a retimed
 * group/old/new picks up any per-target transition the user provided.
 */
function layerOptions(target: ViewTransitionTarget | undefined, type: string) {
    return target?.[layerBuckets[type]]?.options
}
