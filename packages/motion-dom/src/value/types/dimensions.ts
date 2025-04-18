import { auto } from "./auto"
import { number } from "./numbers"
import { degrees, percent, px, vh, vw } from "./numbers/units"
import { testValueType } from "./test"

/**
 * A list of value types commonly used for dimensions
 */
export const dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto]

/**
 * Tests a dimensional value against the list of dimension ValueTypes
 */
export const findDimensionValueType = (v: any) =>
    dimensionValueTypes.find(testValueType(v))
