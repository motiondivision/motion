import { memo, MotionGlobalConfig } from "motion-utils"
import {
    AnyResolvedKeyframe,
    ValueAnimationOptionsWithRenderContext,
} from "../../types"

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

export function supportsBrowserAnimation<T extends AnyResolvedKeyframe>(
    options: ValueAnimationOptionsWithRenderContext<T>
) {
    // Disable WAAPI when manual timing or a custom driver is active
    // In these cases, timing is controlled externally and WAAPI would desync
    if (MotionGlobalConfig.useManualTiming || MotionGlobalConfig.driver) {
        return false
    }

    const { motionValue, name, repeatDelay, repeatType, damping, type } =
        options

    const subject = motionValue?.owner?.current

    /**
     * We use this check instead of isHTMLElement() because we explicitly
     * **don't** want elements in different timing contexts (i.e. popups)
     * to be accelerated, as it's not possible to sync these animations
     * properly with those driven from the main window frameloop.
     */
    if (!(subject instanceof HTMLElement)) {
        return false
    }

    const { onUpdate, transformTemplate } = motionValue!.owner!.getProps()

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
