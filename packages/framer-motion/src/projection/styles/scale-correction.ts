import { isCSSVariableName } from "motion-dom"
import { ScaleCorrectorMap } from "./types"

export const scaleCorrectors: ScaleCorrectorMap = {}

export function addScaleCorrector(correctors: ScaleCorrectorMap) {
    for (const key in correctors) {
        scaleCorrectors[key] = correctors[key]
        if (isCSSVariableName(key)) {
            scaleCorrectors[key].isCSSVariable = true
        }
    }
}
