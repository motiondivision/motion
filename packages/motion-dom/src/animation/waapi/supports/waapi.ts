import { memo } from "motion-utils"
import {
    AnyResolvedKeyframe,
    ValueAnimationOptionsWithRenderContext,
} from "../../types"
import { acceleratedValues } from "../utils/accelerated-values"
import { hasBrowserOnlyColors } from "../utils/is-browser-color"

const colorProperties = new Set([
    "color",
    "backgroundColor",
    "outlineColor",
    "fill",
    "stroke",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
])

const supportsWaapi = /*@__PURE__*/ memo(() =>
    Object.hasOwnProperty.call(Element.prototype, "animate")
)

export function supportsBrowserAnimation<T extends AnyResolvedKeyframe>(
    options: ValueAnimationOptionsWithRenderContext<T>
) {
    const {
        motionValue,
        name,
        repeatDelay,
        repeatType,
        damping,
        type,
        keyframes,
    } = options

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
        /**
         * Force WAAPI for color properties with browser-only color formats
         * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
         */
        (acceleratedValues.has(name) ||
            (colorProperties.has(name) &&
                hasBrowserOnlyColors(keyframes))) &&
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
