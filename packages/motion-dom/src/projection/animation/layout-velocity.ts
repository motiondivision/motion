import { clamp, Point, secondsToMilliseconds } from "motion-utils"
import { getSpringOptions } from "../../animation/generators/spring"
import type { ValueAnimationOptions } from "../../animation/types"

/**
 * A curved path ties x and y to one progress value, so it takes the part of
 * the velocity along the straight line from start to end.
 */
export const pointToProgressVelocity = (
    tx: number,
    ty: number,
    { x, y }: Point
) => {
    const lengthSquared = tx * tx + ty * ty
    return lengthSquared < 1 ? 0 : (-1000 * (x * tx + y * ty)) / lengthSquared
}

/**
 * Only physics springs start with a velocity: time-defined springs ignore
 * it. So resolve duration, visualDuration and bounce to the same physics.
 * With `mass: "auto"`, mass comes from the element's size: a 300px square
 * has mass 1, bigger elements are heavier and slower (mass 0.25 to 2), and
 * damping scales with mass so the spring keeps its bounce. Tweens, untyped
 * transitions and zero-duration springs are unchanged.
 */
export function toVelocityTransition(
    t: any,
    size = 300
): ValueAnimationOptions<number> {
    if (t.type === "spring" && t.duration !== 0) {
        let { stiffness, damping, mass } = getSpringOptions({
            ...t,
            duration: t.duration && secondsToMilliseconds(t.duration),
        })
        if (t.mass === "auto") {
            mass = clamp(0.25, 2, size / 300)
            damping *= Math.sqrt(mass)
        }
        return {
            ...t,
            duration: undefined,
            stiffness,
            damping,
            mass,
        }
    }

    return t
}
