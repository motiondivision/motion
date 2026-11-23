import { MotionGlobalConfig } from "motion-utils"
import {
    AnyResolvedKeyframe,
    ValueAnimationOptionsWithRenderContext,
} from "../../types"
import { acceleratedValues } from "../utils/accelerated-values"
import { hasBrowserOnlyColors } from "../utils/is-browser-color"
import { needsMixer } from "../utils/needs-mixer"

export const colorProperties = new Set([
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

/**
 * WAAPI runs on the browser's clock, so on a manual clock every animation
 * runs in JS where processFrame can drive it. Set the flag before starting
 * animations: running WAAPI animations stay on the browser's clock.
 */
export const supportsWaapi = () =>
    !MotionGlobalConfig.useManualTiming &&
    Object.hasOwnProperty.call(Element.prototype, "animate")

export function canAccelerateOptions(
    options: ValueAnimationOptionsWithRenderContext<any>,
    checkTransformTemplate: boolean
) {
    const { onUpdate, transformTemplate } =
        options.motionValue!.owner!.getProps()

    return (
        !onUpdate &&
        !options.hasOnUpdate &&
        (!checkTransformTemplate || !transformTemplate) &&
        options.type !== "inertia" &&
        !needsMixer(options)
    )
}

export function supportsBrowserAnimation<T extends AnyResolvedKeyframe>(
    options: ValueAnimationOptionsWithRenderContext<T>
) {
    const { motionValue, name, repeatDelay, repeatType, damping, keyframes } =
        options

    const isAccelerated = Boolean(name && acceleratedValues.has(name))

    /**
     * Most values can't be accelerated at all, so check the name before
     * looking at the element or its props.
     */
    if (!isAccelerated && !(name && colorProperties.has(name))) {
        return false
    }

    const subject = motionValue?.owner?.current

    /**
     * We use instanceof checks instead of isHTMLElement()/isSVGElement()
     * because we explicitly **don't** want elements in different timing
     * contexts (i.e. popups) to be accelerated, as it's not possible to sync
     * these animations properly with those driven from the main window
     * frameloop.
     */
    if (!(subject instanceof HTMLElement) && !(subject instanceof SVGElement)) {
        return false
    }

    return (
        supportsWaapi() &&
        /**
         * Force WAAPI for color properties with browser-only color formats
         * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
         */
        (isAccelerated || hasBrowserOnlyColors(keyframes)) &&
        !repeatDelay &&
        repeatType !== "mirror" &&
        damping !== 0 &&
        canAccelerateOptions(options, name === "transform")
    )
}
