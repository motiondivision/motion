import { isCSSVariableName } from "../../animation/utils/is-css-variable"
import { correctBorderRadius } from "./scale-border-radius"
import { correctBoxShadow } from "./scale-box-shadow"
import type { ScaleCorrectorMap } from "./types"

export const scaleCorrectors: ScaleCorrectorMap = {
    borderRadius: {
        ...correctBorderRadius,
        applyTo: [
            "borderTopLeftRadius",
            "borderTopRightRadius",
            "borderBottomLeftRadius",
            "borderBottomRightRadius",
        ],
    },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow,
}

/**
 * Iterable snapshot of scaleCorrectors keys. Projection rendering loops
 * over correctors for every projecting node every frame, and iterating a
 * cached array is cheaper than a for...in over the map.
 */
export const scaleCorrectorKeys = /*@__PURE__*/ Object.keys(scaleCorrectors)

export function addScaleCorrector(correctors: ScaleCorrectorMap) {
    for (const key in correctors) {
        scaleCorrectors[key] = correctors[key]
        if (isCSSVariableName(key)) {
            scaleCorrectors[key].isCSSVariable = true
        }

        if (!scaleCorrectorKeys.includes(key)) {
            scaleCorrectorKeys.push(key)
        }
    }
}
