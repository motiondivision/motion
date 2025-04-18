import { Color, HSLA, RGBA } from "../types"
import { floatRegex } from "../utils/float-regex"
import { isNullish } from "../utils/is-nullish"
import { singleColorRegex } from "../utils/single-color-regex"

/**
 * Returns true if the provided string is a color, ie rgba(0,0,0,0) or #000,
 * but false if a number or multiple colors
 */
export const isColorString = (type: string, testProp?: string) => (v: any) => {
    return Boolean(
        (typeof v === "string" &&
            singleColorRegex.test(v) &&
            v.startsWith(type)) ||
            (testProp &&
                !isNullish(v) &&
                Object.prototype.hasOwnProperty.call(v, testProp))
    )
}

export const splitColor =
    <V extends RGBA | HSLA>(aName: string, bName: string, cName: string) =>
    (v: string | Color): V => {
        if (typeof v !== "string") return v as any

        const [a, b, c, alpha] = v.match(floatRegex) as any

        return {
            [aName]: parseFloat(a),
            [bName]: parseFloat(b),
            [cName]: parseFloat(c),
            alpha: alpha !== undefined ? parseFloat(alpha) : 1,
        } as V
    }
