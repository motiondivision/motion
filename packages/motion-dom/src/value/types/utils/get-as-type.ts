import { ValueType } from "../types"

/**
 * Provided a value and a ValueType, returns the value as that value type.
 *
 * Numeric strings without a unit (e.g. `"15"`) are treated like numbers and
 * have the default unit applied. Strings that already include a unit (e.g.
 * `"15px"` or `"100%"`) pass through unchanged.
 */
export const getValueAsType = (value: any, type?: ValueType) => {
    if (!type) return value
    if (typeof value === "number") return (type as any).transform(value)
    if (typeof value === "string" && value !== "" && !isNaN(value as any)) {
        return (type as any).transform(value)
    }
    return value
}
