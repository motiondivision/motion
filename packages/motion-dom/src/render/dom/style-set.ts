import { AnyResolvedKeyframe } from "../../animation/types"
import { pxValues } from "../../animation/waapi/utils/px-values"
import { nativeNumericValues } from "../../animation/waapi/utils/numeric-values"
import { isCSSVar } from "./is-css-var"

export function setStyle(
    element: HTMLElement | SVGElement,
    name: string,
    value: AnyResolvedKeyframe
) {
    /**
     * A spring can overshoot below the minimum CSS length. Native animation
     * clamps it to zero, but assigning a negative inline length is ignored.
     * Match the native clamp before cancel() exposes the inline style.
     */
    if (nativeNumericValues.has(name) && parseFloat(value as string) < 0) {
        value = 0
    }

    if (typeof value === "number" && pxValues.has(name)) value = value + "px"

    isCSSVar(name)
        ? element.style.setProperty(name, value as string)
        : (element.style[name as any] = value as string)
}
