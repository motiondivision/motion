import { clamp, Point, secondsToMilliseconds } from "motion-utils"
import { getSpringOptions } from "../../animation/generators/spring"
import type { ValueAnimationOptions } from "../../animation/types"

/**
 * Layout animations run on progress values from 0 to 1000. An axis moves
 * its origin point by `translate * (1 - progress / 1000)`, so its page
 * velocity (px/s) is `-translate * progressVelocity / 1000`.
 */
export const progressToPixelVelocity = (
    translate: number,
    progressVelocity: number
) => (-translate * progressVelocity) / 1000

/**
 * An axis that doesn't move can't carry velocity in progress units.
 */
export const pixelToProgressVelocity = (translate: number, velocity: number) =>
    Math.abs(translate) < 1 ? 0 : (-1000 * velocity) / translate

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
 * has mass 1, bigger elements are heavier and slower (mass 0.5 to 2), and
 * damping scales with mass so every size stays critically damped. Other
 * tweens keep their curve and lose the velocity.
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

    if (
        t.type === "spring" ||
        (!t.type && (t.bounce ?? t.visualDuration ?? t.stiffness) !== undefined)
    ) {
        let { stiffness, damping, mass } = getSpringOptions({
            ...t,
            duration: t.duration && secondsToMilliseconds(t.duration),
        })
        if (isDefault) {
            mass = clamp(0.5, 2, size / 300)
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
