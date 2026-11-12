import { clamp, secondsToMilliseconds } from "motion-utils"
import { getSpringOptions } from "../../animation/generators/spring"
import type { ValueAnimationOptions } from "../../animation/types"

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
