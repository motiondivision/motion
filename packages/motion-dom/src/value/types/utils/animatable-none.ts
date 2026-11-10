import { complex } from "../complex"
import { filter } from "../complex/filter"
import { mask } from "../complex/mask"

/**
 * The last call and its result. animate() on many elements asks for the
 * same none for each one, and parsing the value is the slow part.
 */
let lastKey: string | undefined
let lastValue: string | undefined
let lastNone: any

export function getAnimatableNone(key: string, value: string) {
    if (key === lastKey && value === lastValue) return lastNone

    /**
     * Only filter and mask have their own animatable none. Every other
     * value, colors included, uses the complex one.
     */
    lastNone = (
        key === "filter" || key === "WebkitFilter"
            ? filter
            : key === "mask" || key === "WebkitMask"
            ? mask
            : complex
    ).getAnimatableNone(value)
    lastKey = key
    lastValue = value

    return lastNone
}
