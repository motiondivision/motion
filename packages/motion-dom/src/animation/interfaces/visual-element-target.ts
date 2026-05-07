import { frame } from "../../frameloop"
import { getValueTransition } from "../utils/get-value-transition"
import { resolveTransition } from "../utils/resolve-transition"
import { positionalKeys } from "../../render/utils/keys-position"
import { setTarget } from "../../render/utils/setters"
import { addValueToWillChange } from "../../value/will-change/add-will-change"
import { getOptimisedAppearId } from "../optimized-appear/get-appear-id"
import { animateMotionValue } from "./motion-value"
import { motionValue } from "../../value"
import type { Path } from "../types"
import type { VisualElementAnimationOptions } from "./types"
import type { AnimationPlaybackControlsWithThen } from "../types"
import type { TargetAndTransition } from "../../node/types"
import type { AnimationTypeState } from "../../render/utils/animation-state"
import type { VisualElement } from "../../render/VisualElement"

/**
 * Decide whether we should block this animation. Previously, we achieved this
 * just by checking whether the key was listed in protectedKeys, but this
 * posed problems if an animation was triggered by afterChildren and protectedKeys
 * had been set to true in the meantime.
 */
function shouldBlockAnimation(
    { protectedKeys, needsAnimating }: AnimationTypeState,
    key: string
) {
    const shouldBlock =
        protectedKeys.hasOwnProperty(key) && needsAnimating[key] !== true

    needsAnimating[key] = false
    return shouldBlock
}

export function animateTarget(
    visualElement: VisualElement,
    targetAndTransition: TargetAndTransition,
    { delay = 0, transitionOverride, type }: VisualElementAnimationOptions = {}
): AnimationPlaybackControlsWithThen[] {
    let {
        transition,
        transitionEnd,
        ...target
    } = targetAndTransition

    const defaultTransition = visualElement.getDefaultTransition()
    transition = transition
        ? resolveTransition(transition, defaultTransition)
        : defaultTransition

    const reduceMotion = (transition as { reduceMotion?: boolean })?.reduceMotion

    if (transitionOverride) transition = transitionOverride

    const animations: AnimationPlaybackControlsWithThen[] = []

    const animationTypeState =
        type &&
        visualElement.animationState &&
        visualElement.animationState.getState()[type]

    const path = (transition as { path?: Path } | undefined)?.path
    if (path && ("x" in target || "y" in target)) {
        const xValue = visualElement.getValue(
            "x",
            visualElement.latestValues["x"] ?? 0
        )
        const yValue = visualElement.getValue(
            "y",
            visualElement.latestValues["y"] ?? 0
        )

        const xRaw = target.x as number | number[] | undefined
        const yRaw = target.y as number | number[] | undefined

        const xFrom = (Array.isArray(xRaw) && xRaw[0] != null
            ? xRaw[0]
            : xValue?.get()) as number ?? 0
        const yFrom = (Array.isArray(yRaw) && yRaw[0] != null
            ? yRaw[0]
            : yValue?.get()) as number ?? 0
        const xTo = (Array.isArray(xRaw)
            ? xRaw[xRaw.length - 1]
            : xRaw ?? xFrom) as number
        const yTo = (Array.isArray(yRaw)
            ? yRaw[yRaw.length - 1]
            : yRaw ?? yFrom) as number

        const interpolate = path(
            { x: xFrom, y: yFrom },
            { x: xTo, y: yTo }
        )
        // Note: the keyframe consumer doesn't need to flag interruption.
        // If this animation is replacing an in-flight one, x/y motion
        // values already hold the displaced (mid-arc) position, so
        // `xFrom`/`yFrom` carry the necessary continuity geometry.

        // Probe whether this path produces rotation, and capture/restore base.
        const probe = interpolate(0)
        const rotateValue = probe.rotate !== undefined
            ? visualElement.getValue(
                  "rotate",
                  visualElement.latestValues["rotate"] ?? 0
              )
            : undefined
        const baseRotation = rotateValue
            ? ((rotateValue.get() as number) ?? 0)
            : 0

        const pathTransition = {
            delay,
            ...getValueTransition(transition || {}, "x"),
        }
        delete (pathTransition as { path?: Path }).path

        const progress = motionValue(0)
        progress.start(
            animateMotionValue("", progress, [0, 1000] as any, {
                ...pathTransition,
                isSync: true,
                velocity: 0,
                onUpdate: (latest: number) => {
                    const point = interpolate(latest / 1000)
                    xValue?.set(point.x)
                    yValue?.set(point.y)
                    if (rotateValue && point.rotate !== undefined) {
                        rotateValue.set(baseRotation + point.rotate)
                    }
                },
                onComplete: () => {
                    xValue?.set(xTo)
                    yValue?.set(yTo)
                    rotateValue?.set(baseRotation)
                },
            })
        )

        if (progress.animation) animations.push(progress.animation)

        delete (target as { x?: unknown }).x
        delete (target as { y?: unknown }).y
        if (rotateValue) delete (target as { rotate?: unknown }).rotate
    }

    for (const key in target) {
        const value = visualElement.getValue(
            key,
            visualElement.latestValues[key] ?? null
        )
        const valueTarget = target[key as keyof typeof target]

        if (
            valueTarget === undefined ||
            (animationTypeState &&
                shouldBlockAnimation(animationTypeState, key))
        ) {
            continue
        }

        const valueTransition = {
            delay,
            ...getValueTransition(transition || {}, key),
        }

        /**
         * If the value is already at the defined target, skip the animation.
         */
        const currentValue = value.get()
        if (
            currentValue !== undefined &&
            !value.isAnimating &&
            !Array.isArray(valueTarget) &&
            valueTarget === currentValue &&
            !valueTransition.velocity
        ) {
            continue
        }

        /**
         * If this is the first time a value is being animated, check
         * to see if we're handling off from an existing animation.
         */
        let isHandoff = false
        if (window.MotionHandoffAnimation) {
            const appearId = getOptimisedAppearId(visualElement)

            if (appearId) {
                const startTime = window.MotionHandoffAnimation(
                    appearId,
                    key,
                    frame
                )

                if (startTime !== null) {
                    valueTransition.startTime = startTime
                    isHandoff = true
                }
            }
        }

        addValueToWillChange(visualElement, key)

        const shouldReduceMotion =
            reduceMotion ?? visualElement.shouldReduceMotion

        value.start(
            animateMotionValue(
                key,
                value,
                valueTarget,
                shouldReduceMotion && positionalKeys.has(key)
                    ? { type: false }
                    : valueTransition,
                visualElement,
                isHandoff
            )
        )

        const animation = value.animation

        if (animation) {
            animations.push(animation)
        }
    }

    if (transitionEnd) {
        const applyTransitionEnd = () =>
            frame.update(() => {
                transitionEnd && setTarget(visualElement, transitionEnd)
            })

        if (animations.length) {
            Promise.all(animations).then(applyTransitionEnd)
        } else {
            applyTransitionEnd()
        }
    }

    return animations
}
