import { color } from "../color"
import { filter } from "../complex/filter"
import { mask } from "../complex/mask"
import { numberValueTypes } from "./number"
import { ValueTypeMap } from "./types"

/**
 * A map of default value types for common values
 */
export const defaultValueTypes: ValueTypeMap = {
    ...numberValueTypes,

    // Color props
    color,
    backgroundColor: color,
    outlineColor: color,
    fill: color,
    stroke: color,

    // Border props
    borderColor: color,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color,
    borderLeftColor: color,
    filter,
    WebkitFilter: filter,
    mask,
    WebkitMask: mask,
}

/**
 * Gets the default ValueType for the provided value key
 */
export const getDefaultValueType = (key: string) => defaultValueTypes[key]
