import { clamp } from "motion-utils"
import { alpha as alphaType } from "../numbers"
import { RGBA } from "../types"
import { sanitize } from "../utils/sanitize"
import { isColorString, splitColor } from "./utils"

export const rgbUnit = {
    test: (v: any) => typeof v === "number",
    parse: parseFloat,
    transform: (v: number) => Math.round(clamp(0, 255, v)),
}

export const rgbaTransform = ({ red, green, blue, alpha = 1 }: RGBA) =>
    "rgba(" +
    rgbUnit.transform(red) +
    ", " +
    rgbUnit.transform(green) +
    ", " +
    rgbUnit.transform(blue) +
    ", " +
    sanitize(alphaType.transform(alpha)) +
    ")"

export const rgba = {
    test: /*@__PURE__*/ isColorString("rgb", "red"),
    parse: /*@__PURE__*/ splitColor<RGBA>("red", "green", "blue"),
    transform: rgbaTransform,
}
