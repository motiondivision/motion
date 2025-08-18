import { HSLA, RGBA, OKLCH } from "../types"
import { hex } from "./hex"
import { hsla } from "./hsla"
import { oklch } from "./oklch"
import { rgba } from "./rgba"

export const color = {
    test: (v: any) =>
        rgba.test(v) || hex.test(v) || hsla.test(v) || oklch.test(v),
    parse: (v: any): RGBA | HSLA | OKLCH => {
        if (rgba.test(v)) {
            return rgba.parse(v)
        } else if (hsla.test(v)) {
            return hsla.parse(v)
        } else if (oklch.test(v)) {
            return oklch.parse(v)
        } else {
            return hex.parse(v)
        }
    },
    transform: (v: HSLA | RGBA | OKLCH | string) => {
        return typeof v === "string"
            ? v
            : v.hasOwnProperty("red")
            ? rgba.transform(v as RGBA)
            : v.hasOwnProperty("chroma")
            ? oklch.transform(v as OKLCH)
            : hsla.transform(v as HSLA)
    },
    getAnimatableNone: (v: string) => {
        const parsed = color.parse(v)
        parsed.alpha = 0
        return color.transform(parsed)
    },
}
