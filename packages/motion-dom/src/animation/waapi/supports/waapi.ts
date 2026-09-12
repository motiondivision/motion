import { memo } from "motion-utils"
import { findDimensionValueType } from "../../../value/types/dimensions"
import { percent } from "../../../value/types/numbers/units"
import { isNumOrPxType } from "../../keyframes/utils/unit-conversion"
import {
    AnyResolvedKeyframe,
    ValueAnimationOptionsWithRenderContext,
} from "../../types"
import { acceleratedValues } from "../utils/accelerated-values"
import { hasBrowserOnlyColors } from "../utils/is-browser-color"
import { nativeNumericValues } from "../utils/numeric-values"

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

function supportsNumericKeyframes(keyframes: AnyResolvedKeyframe[]) {
    const firstType = findDimensionValueType(keyframes[0])
    if (!isNumOrPxType(firstType) && firstType !== percent) return false

    return keyframes.every((keyframe) => {
        const type = findDimensionValueType(keyframe)
        const value =
            typeof keyframe === "number" ? keyframe : parseFloat(keyframe)
        return Number.isFinite(value) && value >= 0 && type === firstType
    })
}

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

    if (!name) return false

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

    const owner = motionValue!.owner!
    const { onUpdate, transformTemplate, layout, layoutId } = owner.getProps()
    const projection = owner.projection?.options

    /**
     * Native effects override projection's inline scale corrections and
     * don't update the latest values projection renders. Keep new native
     * properties on JS for the whole time an element participates in layout,
     * including between transitions. animateLayout() sets projection options
     * without React props. The attributes also identify vanilla participants
     * before their first layout animation creates a projection node.
     */
    const canAnimateNumeric =
        nativeNumericValues.has(name) &&
        subject instanceof HTMLElement &&
        !layout &&
        layoutId === undefined &&
        !projection?.layout &&
        projection?.layoutId === undefined &&
        !subject.hasAttribute("data-layout") &&
        !subject.hasAttribute("data-layout-id") &&
        supportsNumericKeyframes(keyframes)

    return (
        supportsWaapi() &&
        /**
         * Force WAAPI for color properties with browser-only color formats
         * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
         */
        (acceleratedValues.has(name) ||
            canAnimateNumeric ||
            (colorProperties.has(name) && hasBrowserOnlyColors(keyframes))) &&
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
