import { ValueType } from "./types"

/**
 * ValueType for "auto"
 */
export const auto: ValueType = {
    test: (v: any) => v === "auto",
    parse: (v) => v,
}
