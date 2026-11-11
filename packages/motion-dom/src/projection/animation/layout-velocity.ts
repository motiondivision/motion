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
 * The default layout tween becomes a soft (critically damped) spring of the
 * same visual duration, with mass from the element's size: a 300px square
 * has mass 1, bigger elements are heavier and slower (mass 0.25 to 2), and
 * damping scales with mass so every size stays critically damped. Other
 * tweens, untyped transitions and zero-duration springs are unchanged.
 */
export function toVelocityTransition(
    options: any,
    defaultEase: unknown,
    size = 300
): ValueAnimationOptions<number> {
    const isDefault = options.ease === defaultEase
    const t = isDefault
        ? {
              ...options,
              type: "spring",
              duration: undefined,
              bounce: 0,
              visualDuration: 0.45,
          }
        : options

    /**
     * A zero-duration spring stays instant.
     */
    if (t.type === "spring" && t.duration !== 0) {
        let { stiffness, damping, mass } = getSpringOptions({
            ...t,
            duration: t.duration && secondsToMilliseconds(t.duration),
        })
        if (isDefault) {
            mass = clamp(0.25, 2, size / 300)
            damping *= Math.sqrt(mass)
        }
        return {
            ...t,
            type: "spring",
            duration: undefined,
            stiffness,
            damping,
            mass,
        }
    }

    return options
}
