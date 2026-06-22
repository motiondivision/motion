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
import { ViewTransitionTarget } from "./types"
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

export function startViewAnimation(
    builder: ViewTransitionBuilder
): Promise<GroupAnimation> {
    const { update, targets, resolveDefs, scope, options: defaultOptions } =
        builder

    if (!document.startViewTransition) {
        return new Promise(async (resolve) => {
            await update()
            resolve(new GroupAnimation([]))
        })
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
    /**
     * The ordered layer names belonging to each subject, so stagger/delay
     * functions can resolve per-element across a resolved selector.
     */
    const subjectNames = new Map<ViewTransitionTarget, string[]>()

    const resolveLayers = () => {
        targets.forEach((target, definition) => {
            const names =
                definition !== "root" && resolveDefs.has(definition)
                    ? assignViewTransitionNames(
                          definition as ElementOrSelector,
                          nameRegistry,
                          assigned,
                          scope
                      )
                    : [definition as string]

            let layerNames = subjectNames.get(target)
            if (!layerNames) {
                layerNames = []
                subjectNames.set(target, layerNames)
            }

            for (const name of names) {
                layerTargets.set(name, target)
                if (!layerNames.includes(name)) layerNames.push(name)
            }
        })
    }

    resolveLayers()

    const elementScoped =
        scope && typeof (scope as any).startViewTransition === "function"

    /**
     * If we don't have any animations defined for the root target,
     * remove it from being captured. Not needed when the transition is
     * scoped to an element.
     */
    if (!elementScoped && !hasTarget("root", targets)) {
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

    css.commit() // Write

    const callback = async () => {
        await update()

        /**
         * Re-resolve so elements created by the update are named for the
         * new snapshot.
         */
        resolveLayers()
    }

    const transition = elementScoped
        ? (scope as any).startViewTransition(callback)
        : document.startViewTransition(callback)

    transition.finished.finally(() => {
        releaseViewTransitionNames(assigned)
        css.remove() // Write
    })

    return new Promise((resolve) => {
        transition.ready.then(() => {
            const generatedViewAnimations = getViewAnimations()

            const animations: AnimationPlaybackControls[] = []

            /**
             * Create animations for each of our explicitly-defined subjects.
             */
            layerTargets.forEach((definition, target) => {
                const layerNames = subjectNames.get(definition)
                const index = layerNames ? layerNames.indexOf(target) : 0
                const total = layerNames ? layerNames.length : 1

                for (const key of definitionNames) {
                    if (!definition[key]) continue
                    const { keyframes, options } =
                        definition[key as keyof ViewTransitionTarget]!

                    for (let [valueName, valueKeyframes] of Object.entries(
                        keyframes
                    )) {
                        if (!valueKeyframes) continue

                        const valueOptions = {
                            ...getValueTransition(
                                defaultOptions as any,
                                valueName
                            ),
                            ...getValueTransition(options as any, valueName),
                        }

                        const type = chooseLayerType(
                            key as keyof ViewTransitionTarget
                        )

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
                            valueOptions.delay = valueOptions.delay(index, total)
                        }

                        valueOptions.duration &&= secondsToMilliseconds(
                            valueOptions.duration
                        )

                        valueOptions.delay &&= secondsToMilliseconds(
                            valueOptions.delay
                        )

                        const animation = new NativeAnimation({
                            ...valueOptions,
                            element: document.documentElement,
                            name: valueName,
                            pseudoElement: `::view-transition-${type}(${target})`,
                            keyframes: valueKeyframes,
                        })

                        animations.push(animation)
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
                 * Keep the browser's opacity crossfade (which relies on
                 * mix-blend-mode) when both enter and exit opacity are defined.
                 */
                const isCrossfade =
                    targetDefinition &&
                    hasOpacity(targetDefinition, "enter") &&
                    hasOpacity(targetDefinition, "exit") &&
                    effect
                        .getKeyframes()
                        .some((keyframe) => keyframe.mixBlendMode)

                /**
                 * If we've built an explicit animation for this layer, drop the
                 * browser-generated one.
                 */
                if (
                    !isCrossfade &&
                    targetDefinition &&
                    hasExplicitKeyframes(targetDefinition, name.type)
                ) {
                    animation.cancel()
                    continue
                }

                if (isCrossfade) {
                    animations.push(new NativeAnimationWrapper(animation))
                    continue
                }

                /**
                 * Otherwise retime the browser-generated animation to Motion's
                 * timing. This auto-enables the layout (group) morph for any
                 * resolved/named target, and applies the default timing to
                 * old/new layers we haven't explicitly overridden.
                 */
                const transitionName = name.type === "group" ? "layout" : ""
                let animationTransition = {
                    ...getValueTransition(defaultOptions, transitionName),
                    ...getValueTransition(
                        (layerOptions(targetDefinition, name.type) ?? {}) as any,
                        transitionName
                    ),
                }

                animationTransition.duration &&= secondsToMilliseconds(
                    animationTransition.duration
                )

                animationTransition = applyGeneratorOptions(animationTransition)

                const easing = mapEasingToNativeEasing(
                    animationTransition.ease,
                    animationTransition.duration!
                ) as string

                effect.updateTiming({
                    delay: secondsToMilliseconds(animationTransition.delay ?? 0),
                    duration: animationTransition.duration,
                    easing,
                })

                animations.push(new NativeAnimationWrapper(animation))
            }

            resolve(new GroupAnimation(animations))
        })
    })
}

function hasOpacity(
    target: ViewTransitionTarget | undefined,
    key: "enter" | "exit" | "layout"
) {
    return target?.[key]?.keyframes.opacity
}

/**
 * Whether the user defined explicit keyframes for a given generated layer
 * type, in which case we replace the browser's animation with our own.
 */
function hasExplicitKeyframes(target: ViewTransitionTarget, type: string) {
    const buckets: ReadonlyArray<keyof ViewTransitionTarget> =
        type === "group"
            ? ["layout"]
            : type === "new"
              ? ["enter", "new"]
              : type === "old"
                ? ["exit", "old"]
                : []

    return buckets.some((bucket) => {
        const keyframes = target[bucket]?.keyframes
        return keyframes != null && Object.keys(keyframes).length > 0
    })
}

/**
 * The options that should time a given generated layer type, so a retimed
 * group/old/new picks up any per-target transition the user provided.
 */
function layerOptions(target: ViewTransitionTarget | undefined, type: string) {
    const bucket =
        type === "group"
            ? target?.layout
            : type === "new"
              ? (target?.enter ?? target?.new)
              : type === "old"
                ? (target?.exit ?? target?.old)
                : undefined

    return bucket?.options
}
