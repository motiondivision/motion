import { ValueType } from "../types"

/**
 * Provided a value and a ValueType, returns the value as that value type.
 */
export const getValueAsType = (value: any, type?: ValueType) => {
    return type && typeof value === "number"
        ? (type as any).transform(value)
        : value
}
