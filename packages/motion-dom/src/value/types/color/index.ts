import { HSLA, RGBA } from "../types"
import { hex } from "./hex"
import { hsla } from "./hsla"
import { rgba } from "./rgba"

export const color = {
    test: (v: any) => rgba.test(v) || hex.test(v) || hsla.test(v),
    parse: (v: any): RGBA | HSLA => {
        if (rgba.test(v)) {
            return rgba.parse(v)
        } else if (hsla.test(v)) {
            return hsla.parse(v)
        } else {
            return hex.parse(v)
        }
    },
    transform: (v: HSLA | RGBA | string) => {
        return typeof v === "string"
            ? v
            : v.hasOwnProperty("red")
            ? rgba.transform(v as RGBA)
            : hsla.transform(v as HSLA)
    },
}
