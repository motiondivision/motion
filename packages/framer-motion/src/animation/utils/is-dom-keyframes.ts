import { DOMKeyframesDefinition } from "motion-dom"

export function isDOMKeyframes(
    keyframes: unknown
): keyframes is DOMKeyframesDefinition {
    return typeof keyframes === "object" && !Array.isArray(keyframes)
}
