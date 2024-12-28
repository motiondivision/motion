import { isBezierDefinition } from "../../../utils/is-bezier-definition"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { BezierDefinition, Easing } from "../../types"
import { generateLinearEasing } from "./linear"

export function isWaapiSupportedEasing(easing?: Easing | Easing[]): boolean {
    return Boolean(
        (typeof easing === "function" && supportsLinearEasing()) ||
            !easing ||
            (typeof easing === "string" &&
                (easing in supportedWaapiEasing || supportsLinearEasing())) ||
            isBezierDefinition(easing) ||
            (Array.isArray(easing) && easing.every(isWaapiSupportedEasing))
    )
}

export const cubicBezierAsString = ([a, b, c, d]: BezierDefinition) =>
    `cubic-bezier(${a}, ${b}, ${c}, ${d})`

export const supportedWaapiEasing = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: /*@__PURE__*/ cubicBezierAsString([0, 0.65, 0.55, 1]),
    circOut: /*@__PURE__*/ cubicBezierAsString([0.55, 0, 1, 0.45]),
    backIn: /*@__PURE__*/ cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
    backOut: /*@__PURE__*/ cubicBezierAsString([0.33, 1.53, 0.69, 0.99]),
}

export function mapEasingToNativeEasing(
    easing: Easing | Easing[] | undefined,
    duration: number
): undefined | string | string[] {
    if (!easing) {
        return undefined
    } else if (typeof easing === "function" && supportsLinearEasing()) {
        return generateLinearEasing(easing, duration)
    } else if (isBezierDefinition(easing)) {
        return cubicBezierAsString(easing)
    } else if (Array.isArray(easing)) {
        return easing.map(
            (segmentEasing) =>
                (mapEasingToNativeEasing(segmentEasing, duration) as string) ||
                supportedWaapiEasing.easeOut
        )
    } else {
        return supportedWaapiEasing[easing as keyof typeof supportedWaapiEasing]
    }
}
