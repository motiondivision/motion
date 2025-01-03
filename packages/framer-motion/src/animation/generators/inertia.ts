import { ValueAnimationOptions } from "motion-dom"
import { spring as createSpring } from "./spring"
import { AnimationState, KeyframeGenerator } from "./types"
import { calcGeneratorVelocity } from "./utils/velocity"

export function inertia({
    keyframes,
    velocity = 0.0,
    power = 0.8,
    timeConstant = 325,
    bounceDamping = 10,
    bounceStiffness = 500,
    modifyTarget,
    min,
    max,
    restDelta = 0.5,
    restSpeed,
}: ValueAnimationOptions<number>): KeyframeGenerator<number> {
    const origin = keyframes[0]

    const state: AnimationState<number> = {
        done: false,
        value: origin,
    }

    const isOutOfBounds = (v: number) =>
        (min !== undefined && v < min) || (max !== undefined && v > max)

    const nearestBoundary = (v: number) => {
        if (min === undefined) return max
        if (max === undefined) return min

        return Math.abs(min - v) < Math.abs(max - v) ? min : max
    }

    let amplitude = power * velocity
    const ideal = origin + amplitude
    const target = modifyTarget === undefined ? ideal : modifyTarget(ideal)

    /**
     * If the target has changed we need to re-calculate the amplitude, otherwise
     * the animation will start from the wrong position.
     */
    if (target !== ideal) amplitude = target - origin

    const calcDelta = (t: number) => -amplitude * Math.exp(-t / timeConstant)

    const calcLatest = (t: number) => target + calcDelta(t)

    const applyFriction = (t: number) => {
        const delta = calcDelta(t)
        const latest = calcLatest(t)
        state.done = Math.abs(delta) <= restDelta
        state.value = state.done ? target : latest
    }

    /**
     * Ideally this would resolve for t in a stateless way, we could
     * do that by always precalculating the animation but as we know
     * this will be done anyway we can assume that spring will
     * be discovered during that.
     */
    let timeReachedBoundary: number | undefined
    let spring: KeyframeGenerator<number> | undefined

    const checkCatchBoundary = (t: number) => {
        if (!isOutOfBounds(state.value)) return

        timeReachedBoundary = t

        spring = createSpring({
            keyframes: [state.value, nearestBoundary(state.value)!],
            velocity: calcGeneratorVelocity(calcLatest, t, state.value), // TODO: This should be passing * 1000
            damping: bounceDamping,
            stiffness: bounceStiffness,
            restDelta,
            restSpeed,
        })
    }

    checkCatchBoundary(0)

    return {
        calculatedDuration: null,
        next: (t: number) => {
            /**
             * We need to resolve the friction to figure out if we need a
             * spring but we don't want to do this twice per frame. So here
             * we flag if we updated for this frame and later if we did
             * we can skip doing it again.
             */
            let hasUpdatedFrame = false
            if (!spring && timeReachedBoundary === undefined) {
                hasUpdatedFrame = true
                applyFriction(t)
                checkCatchBoundary(t)
            }

            /**
             * If we have a spring and the provided t is beyond the moment the friction
             * animation crossed the min/max boundary, use the spring.
             */
            if (timeReachedBoundary !== undefined && t >= timeReachedBoundary) {
                return spring!.next(t - timeReachedBoundary)
            } else {
                !hasUpdatedFrame && applyFriction(t)
                return state
            }
        },
    }
}
