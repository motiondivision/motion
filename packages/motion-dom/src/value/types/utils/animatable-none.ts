import { complex } from "../complex"
import { filter } from "../complex/filter"
import { mask } from "../complex/mask"
import { getDefaultValueType } from "../maps/defaults"

const customTypes = /*@__PURE__*/ new Set([filter, mask])

/**
 * The last call and its result. animate() on many elements asks for the
 * same none for each one, and parsing the value is the slow part.
 */
let lastKey: string | undefined
let lastValue: string | undefined
let lastNone: any

export function getAnimatableNone(key: string, value: string) {
    if (key === lastKey && value === lastValue) return lastNone

    let defaultValueType = getDefaultValueType(key)
    if (!customTypes.has(defaultValueType as any)) defaultValueType = complex
    // If value is not recognised as animatable, ie "none", create an animatable version origin based on the target
    lastNone = defaultValueType.getAnimatableNone
        ? defaultValueType.getAnimatableNone(value)
        : undefined
    lastKey = key
    lastValue = value

    return lastNone
}
