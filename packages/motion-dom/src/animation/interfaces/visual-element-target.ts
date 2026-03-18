import { frame } from "../../frameloop"
import { getValueTransition } from "../utils/get-value-transition"
import { resolveTransition } from "../utils/resolve-transition"
import { positionalKeys } from "../../render/utils/keys-position"
import { setTarget } from "../../render/utils/setters"
import { addValueToWillChange } from "../../value/will-change/add-will-change"
import { getOptimisedAppearId } from "../optimized-appear/get-appear-id"
import { animateMotionValue } from "./motion-value"
import {
    bezierPoint,
    bezierTangentAngle,
    computeArcControlPoint,
    normalizeAngle,
    resolveArcAmplitude,
} from "../utils/arc"
import { motionValue } from "../../value"
import type { Arc } from "../types"
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

    const arc = (transition as any)?.arc as Arc | undefined
    if (arc && ("x" in target || "y" in target)) {
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

        const amplitude = resolveArcAmplitude(arc, xTo - xFrom, yTo - yFrom)
        const control = computeArcControlPoint(
            xFrom,
            yFrom,
            xTo,
            yTo,
            amplitude,
            arc.peak ?? 0.5
        )

        const rotationScale =
            arc.orientToPath === true
                ? 0.5
                : typeof arc.orientToPath === "number"
                ? arc.orientToPath
                : 0
        const rotateValue = rotationScale
            ? visualElement.getValue(
                  "rotate",
                  visualElement.latestValues["rotate"] ?? 0
              )
            : undefined
        const baseRotation = rotateValue
            ? ((rotateValue.get() as number) ?? 0)
            : 0

        // Pre-compute start/end tangent angles so we can normalize
        // the rotation to 0 at both endpoints (no jump in/out)
        const tangentAt0 = rotateValue
            ? bezierTangentAngle(0, xFrom, control.x, xTo, yFrom, control.y, yTo)
            : 0
        const tangentAt1 = rotateValue
            ? bezierTangentAngle(1, xFrom, control.x, xTo, yFrom, control.y, yTo)
            : 0

        const arcTransition = {
            delay,
            ...getValueTransition(transition || {}, "x"),
        }
        delete (arcTransition as any).arc

        const progress = motionValue(0)
        progress.start(
            animateMotionValue("", progress, [0, 1000] as any, {
                ...arcTransition,
                isSync: true,
                velocity: 0,
                onUpdate: (latest: number) => {
                    const t = latest / 1000
                    xValue?.set(bezierPoint(t, xFrom, control.x, xTo))
                    yValue?.set(bezierPoint(t, yFrom, control.y, yTo))
                    if (rotateValue) {
                        const raw = bezierTangentAngle(
                            t,
                            xFrom, control.x, xTo,
                            yFrom, control.y, yTo
                        )
                        const baseline =
                            tangentAt0 +
                            normalizeAngle(tangentAt1 - tangentAt0) * t
                        rotateValue.set(
                            baseRotation +
                                normalizeAngle(raw - baseline) *
                                    rotationScale
                        )
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

        delete (target as any).x
        delete (target as any).y
        if (arc.orientToPath) delete (target as any).rotate
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
         * We still re-assert the value via frame.update to take precedence
         * over any stale transitionEnd callbacks from previous animations.
         */
        const currentValue = value.get()
        if (
            currentValue !== undefined &&
            !value.isAnimating() &&
            !Array.isArray(valueTarget) &&
            valueTarget === currentValue &&
            !valueTransition.velocity
        ) {
            frame.update(() => value.set(valueTarget as any))
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
