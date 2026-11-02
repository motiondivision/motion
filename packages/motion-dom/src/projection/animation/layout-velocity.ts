import { Point, secondsToMilliseconds } from "motion-utils"
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
 * The default layout tween becomes a critically damped spring of the same
 * visual duration. Other tweens keep their curve and lose the velocity.
 */
export function toVelocityTransition(
    options: ValueAnimationOptions<number>,
    defaultEase: unknown
): ValueAnimationOptions<number> {
    let { type, duration, bounce, visualDuration, ...rest } = options as any

    if (options.ease === defaultEase) {
        type = "spring"
        duration = undefined
        bounce = 0
        visualDuration = 0.45
        delete rest.ease
    }

    if (
        type !== "spring" &&
        (type ||
            (bounce === undefined &&
                visualDuration === undefined &&
                rest.stiffness === undefined))
    ) {
        return options
    }

    const { stiffness, damping, mass } = getSpringOptions({
        ...rest,
        duration:
            duration === undefined
                ? undefined
                : secondsToMilliseconds(duration),
        bounce,
        visualDuration,
    })

    return { ...rest, type: "spring", stiffness, damping, mass }
}
