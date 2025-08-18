import { alpha as alphaType } from "../numbers"
import { percent } from "../numbers/units"
import { OKLCH } from "../types"
import { sanitize } from "../utils/sanitize"
import { isColorString, splitColor } from "./utils"

export const oklch = {
    test: /*@__PURE__*/ isColorString("oklch", "lightness"),
    parse: /*@__PURE__*/ splitColor<OKLCH>("lightness", "chroma", "hue"),
    transform: ({ lightness, chroma, hue, alpha = 1 }: OKLCH) => {
        return (
            "oklch(" +
            percent.transform(sanitize(lightness)) +
            " " +
            sanitize(chroma) +
            " " +
            sanitize(hue) +
            " / " +
            sanitize(alphaType.transform(alpha)) +
            ")"
        )
    },
}
