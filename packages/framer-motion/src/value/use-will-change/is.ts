import { isMotionValue } from "motion-dom"
import { WillChange } from "./types"

export function isWillChangeMotionValue(value: any): value is WillChange {
    return Boolean(isMotionValue(value) && (value as WillChange).add)
}
