import { complex } from "../complex"
import { filter } from "../complex/filter"
import { mask } from "../complex/mask"
import { getDefaultValueType } from "../maps/defaults"

const customTypes = /*@__PURE__*/ new Set([filter, mask])

export function getAnimatableNone(key: string, value: string) {
    let defaultValueType = getDefaultValueType(key)
    if (!customTypes.has(defaultValueType as any)) defaultValueType = complex
    // If value is not recognised as animatable, ie "none", create an animatable version origin based on the target
    return defaultValueType.getAnimatableNone
        ? defaultValueType.getAnimatableNone(value)
        : undefined
}
