import { secondsToMilliseconds, warnOnce } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import { NativeAnimation } from "../animation/NativeAnimation"
import { NativeAnimationWrapper } from "../animation/NativeAnimationWrapper"
import { AnimationPlaybackControls, DOMKeyframesDefinition } from "../animation/types"
import { getValueTransition } from "../animation/utils/get-value-transition"
import { mapEasingToNativeEasing } from "../animation/waapi/easing/map-easing"
import { applyGeneratorOptions } from "../animation/waapi/utils/apply-generator"
import { ElementOrSelector, resolveElements } from "../utils/resolve-elements"
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

const definitionNames = ["layout", "enter", "exit", "new", "old"] as const

/**
 * The `ViewTransitionTarget` buckets driving each generated layer type, in
 * priority order - the inverse of `chooseLayerType`. The new view is driven by
 * `new`/`enter`, the old by `old`/`exit`. `group-children`/`image-pair` have no
 * bucket; they follow the default layout timing.
 */
const typeBuckets: Record<string, (keyof ViewTransitionTarget)[]> = {
    group: ["layout"],
    new: ["new", "enter"],
    old: ["old", "exit"],
}

/**
 * Default "absent" origin for a single-value keyframe, by pseudo type, so e.g.
 * `enter({ scale: 1 })` grows in from 0.85 and `exit({ opacity: 0 })` fades
 * from 1. `enter` prefers the matching `exit` value over these (see below).
 */
const ORIGIN_DEFAULTS: Record<string, Record<string, number>> = {
    new: { opacity: 0, scale: 0.85 },
    old: { opacity: 1, scale: 1 },
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
        classNames,
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
    /**
     * Elements we tagged with a `view-transition-class` (via `.class()`),
     * tracked separately from `assigned` so cleanup removes the class without
     * ever stripping an author's own inline `view-transition-name`.
     */
    const classed: Element[] = []
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
    /**
     * The old (`from`) elements of each paired subject, so their names can be
     * transferred off before the new (`to`) elements inherit them.
     */
    const pairFrom = new Map<ViewTransitionTargetDefinition, Element[]>()

    const resolveLayers = (phase: "old" | "new") => {
        targets.forEach((target, definition) => {
            const className = classNames.get(definition)
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
                    pairFrom.set(
                        definition,
                        resolveElements(definition as ElementOrSelector)
                    )
                    names = assignViewTransitionNames(
                        definition as ElementOrSelector,
                        nameRegistry,
                        assigned,
                        undefined,
                        className,
                        classed
                    )
                    pairNames.set(definition, names)
                } else {
                    /**
                     * Transfer the name(s) off the `from` elements before the
                     * `to` elements inherit them. A `from` that survives into
                     * the new snapshot (e.g. hidden with `visibility: hidden`
                     * rather than removed) would otherwise keep the name and
                     * collide - "duplicate view-transition-name".
                     */
                    for (const el of pairFrom.get(definition) ?? []) {
                        ;(el as HTMLElement).style?.removeProperty(
                            "view-transition-name"
                        )
                        /**
                         * Drop the old end from the registry too, so the new
                         * end alone supplies this name's `new` crop radii - we
                         * neither re-measure nor get ordered by a stale element.
                         */
                        nameRegistry.delete(el)
                    }
                    names = assignViewTransitionNames(
                        pairs.get(definition) as ElementOrSelector,
                        nameRegistry,
                        assigned,
                        pairNames.get(definition),
                        className,
                        classed
                    )
                }
            } else {
                names = assignViewTransitionNames(
                    definition as ElementOrSelector,
                    nameRegistry,
                    assigned,
                    undefined,
                    className,
                    classed
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
        const transition = mergeTransition(
            getValueTransition(defaultOptions, transitionName),
            getValueTransition(
                (layerOptions(target, type) ?? {}) as any,
                transitionName
            )
        )

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

    /**
     * Write the persistent view-transition CSS: suppress root capture when the
     * root has no animations of its own; force linear timing (baked into the
     * keyframes, so we can retime later via updateTiming); and clip +
     * object-fit: cover every cropped morph (the UA default overflows on
     * aspect-ratio change), with an animated border-radius added below.
     *
     * `css.commit` replaces rather than appends, so we re-set the full rule set
     * each call - the second call (in the update callback) then picks up cropped
     * layers that only exist in the new snapshot.
     */
    const commitViewCSS = () => {
        if (!hasTarget("root", targets)) {
            css.set(":root", { "view-transition-name": "none" })
        }

        css.set(
            "::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)",
            { "animation-timing-function": "linear !important" }
        )

        croppedNames.forEach((name) => {
            css.set(`::view-transition-group(${name})`, { overflow: "clip" })
            css.set(
                `::view-transition-old(${name}), ::view-transition-new(${name})`,
                { width: "100%", height: "100%", "object-fit": "cover" }
            )
        })

        css.commit() // Write
    }

    const cleanup = () => {
        releaseViewTransitionNames(assigned, classed)
        css.remove() // Write
    }

    const callback = async () => {
        await update()

        /**
         * Re-resolve so elements created by the update are named for the new
         * snapshot, then measure the cropped layers' new border-radius.
         */
        const croppedBefore = croppedNames.size
        resolveLayers("new")
        measureCrop("new")

        /**
         * Re-commit the crop CSS only if the new snapshot introduced cropped
         * layers, so a layer that exists only in the new snapshot is clipped
         * too - without forcing a redundant style write on the common path.
         */
        if (croppedNames.size > croppedBefore) commitViewCSS()
    }

    let transition: ViewTransition
    try {
        resolveLayers("old")
        measureCrop("old")
        commitViewCSS()
        transition = document.startViewTransition(callback)
    } catch (error) {
        /**
         * The prelude writes inline names before the transition exists. If it
         * throws (e.g. startViewTransition rejects in a bad UA state), release
         * them so we neither leak DOM state nor stall the queue on a promise
         * that never settles - hand back a rejection it can advance past.
         */
        cleanup()
        return Promise.reject(error)
    }

    transition.finished.finally(cleanup)

    return new Promise<GroupAnimation>((resolve, reject) => {
        transition.ready
            .then(() => {
                const generatedViewAnimations = getViewAnimations()

                const animations: AnimationPlaybackControls[] = []

                /**
                 * Create animations for each of our explicitly-defined subjects.
                 * `opacityAnimated` additionally tracks which `${name}:${type}`
                 * we faded, so we can keep the UA `plus-lighter` blend only for a
                 * genuine opacity crossfade (both sides fading) and drop it for a
                 * slide/transform, where additive compositing would flash bright.
                 */
                const explicitlyAnimated = new Set<string>()
                const opacityAnimated = new Set<string>()
                layerTargets.forEach((target, name) => {
                    const stagger = layerStagger.get(name)
                    /**
                     * Presence: `enter` only fires for a pure newcomer (a new
                     * view with no old), `exit` only for a pure leaver. A
                     * survivor (both) gets neither - it just morphs.
                     */
                    const enterApplies = !!stagger?.new && !stagger?.old
                    const exitApplies = !!stagger?.old && !stagger?.new

                    for (const key of definitionNames) {
                        if (!target[key]) continue
                        if (key === "enter" && !enterApplies) continue
                        if (key === "exit" && !exitApplies) continue

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

                            /**
                             * The view path hands keyframes straight to WAAPI,
                             * so Motion's `x`/`y` shorthands (compiled to
                             * `transform` only via the value pipeline) have no
                             * effect. Warn and skip - use `transform`/`translate`.
                             */
                            if (valueName === "x" || valueName === "y") {
                                warnOnce(
                                    false,
                                    `animateView() animates view-transition layers with CSS properties; the "${valueName}" shorthand has no effect - use transform, e.g. { transform: "translateX(40px)" }.`
                                )
                                continue
                            }

                            /**
                             * enter/exit win over new/old on a shared property -
                             * skip it here when the gated bucket also defines it.
                             */
                            if (
                                key === "new" &&
                                enterApplies &&
                                target.enter?.keyframes[
                                    valueName as keyof DOMKeyframesDefinition
                                ] != null
                            ) {
                                continue
                            }
                            if (
                                key === "old" &&
                                exitApplies &&
                                target.exit?.keyframes[
                                    valueName as keyof DOMKeyframesDefinition
                                ] != null
                            ) {
                                continue
                            }

                            const valueOptions = mergeTransition(
                                getValueTransition(
                                    defaultOptions as any,
                                    valueName
                                ),
                                getValueTransition(options as any, valueName)
                            )

                            /**
                             * Infer an origin for a single-value keyframe. An
                             * `enter` mirrors the matching `exit` value (a
                             * defined exit reverses into the enter for free);
                             * otherwise the per-type default (opacity 0/1, scale
                             * 0.85). No default -> left as-is (animates from the
                             * live value).
                             *
                             * `new`/`old` fire for survivors too, where only the
                             * opacity crossfade default applies - a transform
                             * default like scale 0.85 would pop a persisting
                             * element, so gate it on the layer actually
                             * entering/leaving.
                             */
                            if (!Array.isArray(valueKeyframes)) {
                                const exitValue =
                                    key === "enter"
                                        ? target.exit?.keyframes[
                                              valueName as keyof DOMKeyframesDefinition
                                          ]
                                        : undefined
                                const allowDefault =
                                    valueName === "opacity" ||
                                    (type === "new" ? enterApplies : exitApplies)
                                const from =
                                    exitValue != null
                                        ? Array.isArray(exitValue)
                                            ? exitValue[exitValue.length - 1]
                                            : exitValue
                                        : allowDefault
                                          ? ORIGIN_DEFAULTS[type]?.[valueName]
                                          : undefined
                                if (from !== undefined) {
                                    valueKeyframes = [from, valueKeyframes]
                                }
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
                            explicitlyAnimated.add(`${name}:${type}`)
                            if (valueName === "opacity") {
                                opacityAnimated.add(`${name}:${type}`)
                            }
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
                     * We built our own animation for this layer, so drop the
                     * browser-generated fade we're replacing. The UA
                     * `plus-lighter` blend is a *separate* generated animation on
                     * the same pseudo (it sets `mix-blend-mode` in its keyframes):
                     * keep it *only* for a true opacity crossfade - both sides
                     * fading - so a symmetric crossfade composites without
                     * darkening, but a slide/transform (where both layers stay
                     * opaque and overlap) doesn't flash bright from the addition.
                     */
                    if (explicitlyAnimated.has(`${name.layer}:${name.type}`)) {
                        const isCrossfade =
                            opacityAnimated.has(`${name.layer}:new`) &&
                            opacityAnimated.has(`${name.layer}:old`)
                        if (
                            isCrossfade &&
                            effect
                                .getKeyframes()
                                .some((keyframe) => keyframe.mixBlendMode)
                        ) {
                            animations.push(new NativeAnimationWrapper(animation))
                        } else {
                            animation.cancel()
                        }
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
                    /**
                     * A survivor's old + new are the two halves of one
                     * `plus-lighter` crossfade. They must share identical timing
                     * (so their opacities stay mirrored and sum to 1 - else the
                     * additive blend flashes bright wherever both are partly
                     * visible) and fade linearly (the bounce belongs on the
                     * group's geometry, not the opacity). So time them as the
                     * group, rather than via their own - potentially staggered,
                     * or enter/exit-derived - old/new options.
                     */
                    const stagger = layerStagger.get(name.layer)
                    const isMorphCrossfade =
                        (name.type === "old" || name.type === "new") &&
                        !!stagger?.old &&
                        !!stagger?.new
                    const timingType =
                        name.type.startsWith("group") || isMorphCrossfade
                            ? "group"
                            : name.type

                    const [index, total] = staggerPosition(
                        name.layer,
                        timingType
                    )
                    const transitionName =
                        timingType === "group" ? "layout" : ""
                    let animationTransition = resolveLayerTransition(
                        targetDefinition,
                        timingType,
                        transitionName,
                        index === -1 ? 0 : index,
                        total
                    )

                    /**
                     * The crossfade should resolve at the spring's *perceptual*
                     * (visual) duration - the geometry can keep bouncing, but the
                     * opacity shouldn't drag through the settle. So capture
                     * `visualDuration` before `applyGeneratorOptions` replaces it
                     * with the full overshoot duration, and use it for the fade.
                     */
                    const visualDuration = animationTransition.visualDuration

                    animationTransition.duration &&= secondsToMilliseconds(
                        animationTransition.duration
                    )

                    animationTransition =
                        applyGeneratorOptions(animationTransition)

                    const duration =
                        isMorphCrossfade && visualDuration !== undefined
                            ? secondsToMilliseconds(visualDuration)
                            : animationTransition.duration

                    const easing = isMorphCrossfade
                        ? "linear"
                        : (mapEasingToNativeEasing(
                              animationTransition.ease,
                              animationTransition.duration!
                          ) as string)

                    effect.updateTiming({
                        delay: secondsToMilliseconds(
                            animationTransition.delay ?? 0
                        ),
                        duration,
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
            .catch(() =>
                /**
                 * `ready` rejects when the transition is skipped - no visual
                 * change, or superseded by an interrupting transition. The DOM
                 * update still applied, so settle with no animations rather than
                 * surfacing it as an error to an awaiting caller. A genuine
                 * failure in `update()` rejects `updateCallbackDone` (already
                 * settled by now), so propagate that instead.
                 */
                transition.updateCallbackDone.then(
                    () => resolve(new GroupAnimation([])),
                    reject
                )
            )
    })
}

/**
 * The options that should time a given generated layer type, so a retimed
 * group/old/new picks up any per-target transition the user provided. Checks
 * the type's buckets in priority order (e.g. `new` before `enter`).
 */
function layerOptions(target: ViewTransitionTarget | undefined, type: string) {
    for (const bucket of typeBuckets[type] ?? []) {
        const options = target?.[bucket]?.options
        if (options) return options
    }
}

/**
 * Merge a base transition (e.g. the default `options`) with a per-layer/value
 * override. An explicit `duration` on the override must win over an inherited
 * generator's own timing: a spring prefers `visualDuration`, and
 * `spring.applyToOptions` overwrites `duration` with the computed settle time -
 * so without this the override is silently discarded. Dropping the inherited
 * `type`/`visualDuration` makes the layer a plain tween of that duration, unless
 * it asked for its own generator `type`/`visualDuration`.
 */
function mergeTransition(base: any, override: any) {
    const merged = { ...base, ...override }

    if (override.duration !== undefined) {
        if (override.visualDuration === undefined) delete merged.visualDuration
        if (override.type === undefined) delete merged.type
    }

    return merged
}
