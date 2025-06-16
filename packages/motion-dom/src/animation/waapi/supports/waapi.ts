import { memo } from "motion-utils"
import { isHTMLElement } from "../../../utils/is-html-element"
import { ValueAnimationOptionsWithRenderContext } from "../../types"

/**
 * A list of values that can be hardware-accelerated.
 */
const acceleratedValues = new Set<string>([
    "opacity",
    "clipPath",
    "filter",
    "transform",
    // TODO: Could be re-enabled now we have support for linear() easing
    // "background-color"
])

const supportsWaapi = /*@__PURE__*/ memo(() =>
    Object.hasOwnProperty.call(Element.prototype, "animate")
)

export function supportsBrowserAnimation<T extends string | number>(
    options: ValueAnimationOptionsWithRenderContext<T>
) {
    const { motionValue, name, repeatDelay, repeatType, damping, type } =
        options

    if (!isHTMLElement(motionValue?.owner?.current)) {
        return false
    }

    const { onUpdate, transformTemplate } = motionValue.owner.getProps()

    return (
        supportsWaapi() &&
        name &&
        acceleratedValues.has(name) &&
        (name !== "transform" || !transformTemplate) &&
        /**
         * If we're outputting values to onUpdate then we can't use WAAPI as there's
         * no way to read the value from WAAPI every frame.
         */
        !onUpdate &&
        !repeatDelay &&
        repeatType !== "mirror" &&
        damping !== 0 &&
        type !== "inertia"
    )
}
