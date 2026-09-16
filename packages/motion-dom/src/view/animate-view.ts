import { secondsToMilliseconds } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import { NativeAnimation } from "../animation/NativeAnimation"
import { NativeAnimationWrapper } from "../animation/NativeAnimationWrapper"
import {
    AnimationPlaybackControls,
    Target,
    Transition,
} from "../animation/types"
import { getValueTransition } from "../animation/utils/get-value-transition"
import { applyGeneratorOptions } from "../animation/waapi/utils/apply-generator"
import { mapEasingToNativeEasing } from "../animation/waapi/easing/map-easing"
import { ViewAnimationOptions, ViewAnimationType } from "./animate-view-types"
import { getViewAnimationLayerInfo } from "./utils/get-layer-info"
import { getViewAnimations } from "./utils/get-view-animations"

/** Animate the browser-generated pseudo-elements for a view boundary. */
export function animateView(
    name: string,
    animationType: ViewAnimationType,
    {
        transition,
        onAnimationStart,
        onAnimationComplete,
        ...props
    }: ViewAnimationOptions,
    types: string[]
): VoidFunction {
    const layerAnimations: AnimationPlaybackControls[] = []
    const definition = props[animationType]
    const { transition: typeTransition, ...values } =
        (typeof definition === "function" ? definition(types) : definition) ||
        {}
    const hasValues = Object.keys(values).length > 0
    let hasMatchingAnimation = false

    for (const viewAnimation of getViewAnimations()) {
        if (viewAnimation.playState === "finished") continue

        const { effect } = viewAnimation
        if (!(effect instanceof KeyframeEffect) || !effect.pseudoElement)
            continue

        const info = getViewAnimationLayerInfo(effect.pseudoElement)
        if (!info || info.layer !== name) continue
        hasMatchingAnimation = true

        /**
         * Custom values replace the browser's crossfade (old/new layers).
         * The group layer carries the position/size morph, so keep it running
         * with Motion's timing.
         */
        if (hasValues && info.type !== "group") {
            viewAnimation.cancel()
        } else {
            const transitionName = info.type === "group" ? "layout" : ""
            let options = {
                ...getValueTransition(transition, transitionName),
                ...getValueTransition(typeTransition, transitionName),
            }
            options.duration = secondsToMilliseconds(options.duration ?? 0.3)
            options = applyGeneratorOptions(options)

            effect.updateTiming({
                delay: secondsToMilliseconds(options.delay ?? 0),
                duration: options.duration,
                easing: mapEasingToNativeEasing(
                    options.ease,
                    options.duration!
                ) as string,
            })
            layerAnimations.push(new NativeAnimationWrapper(viewAnimation))
        }
    }

    if (hasValues && hasMatchingAnimation) {
        layerAnimations.push(
            ...createViewAnimations(
                name,
                animationType,
                values,
                transition,
                typeTransition
            )
        )
    }

    const animation = new GroupAnimation(layerAnimations)
    let active = true
    onAnimationStart?.(animation, animationType)
    if (onAnimationComplete) {
        animation.finished.then(() => {
            if (active) onAnimationComplete(animationType)
        })
    }

    return () => {
        active = false
        animation.cancel()
    }
}

function createViewAnimations(
    layerName: string,
    animationType: "enter" | "exit" | "share" | "update",
    values: Target,
    defaultTransition: Transition | undefined,
    transition: Transition | undefined
): AnimationPlaybackControls[] {
    const animations: AnimationPlaybackControls[] = []

    for (const [name, value] of Object.entries(values)) {
        let keyframes = value
        const options = {
            ...getValueTransition(defaultTransition, name),
            ...getValueTransition(transition, name),
        }

        options.duration &&= secondsToMilliseconds(options.duration)

        options.delay &&= secondsToMilliseconds(options.delay)

        if (name === "opacity" && !Array.isArray(keyframes)) {
            const initialValue = animationType === "enter" ? 0 : 1
            keyframes = [initialValue, keyframes]
        }

        const animation = new NativeAnimation({
            ...options,
            element: document.documentElement,
            name,
            pseudoElement: `::view-transition-${
                animationType === "enter" ? "new" : "old"
            }(${layerName})`,
            keyframes,
        })

        animations.push(animation)
    }

    return animations
}
