import type { MotionValue } from ".."

export const isMotionValue = (value: any): value is MotionValue =>
    Boolean(value && value.getVelocity)
