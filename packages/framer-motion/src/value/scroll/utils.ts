import type { MotionValue } from "motion-dom"

/**
 * @public
 */
export interface ScrollMotionValues {
    scrollX: MotionValue<number>
    scrollY: MotionValue<number>
    scrollXProgress: MotionValue<number>
    scrollYProgress: MotionValue<number>
}
