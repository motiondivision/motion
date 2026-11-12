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
 * With `mass: "auto"`, mass comes from the element's size: a 300px square
 * has mass 1, bigger elements are heavier and slower (mass 0.25 to 2), and
 * damping scales with mass so the spring keeps its bounce. The result is a
 * physics spring.
 */
export const resolveAutoMass = (
    t: any,
    size = 300
): ValueAnimationOptions<number> => {
    const mass = clamp(0.25, 2, size / 300)
    const { stiffness, damping } = getSpringOptions({
        ...t,
        duration: t.duration && secondsToMilliseconds(t.duration),
    })
    return { ...t, stiffness, damping: damping * Math.sqrt(mass), mass }
}
