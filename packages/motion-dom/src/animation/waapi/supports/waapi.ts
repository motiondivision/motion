import { memo } from "motion-utils"
import {
    AnyResolvedKeyframe,
    ValueAnimationOptionsWithRenderContext,
} from "../../types"
import type { Owner } from "../../../value"
import type { ResolvedValues } from "../../../render/types"
import { getOptimisedAppearId } from "../../optimized-appear/get-appear-id"
import type { WithAppearProps } from "../../optimized-appear/types"
import { acceleratedValues } from "../utils/accelerated-values"
import { hasBrowserOnlyColors } from "../utils/is-browser-color"
import {
    canUseIndependentTransforms,
    independentTransformProperty,
} from "../../../render/html/utils/independent-transforms"
import { supportsIndependentTransforms } from "../../../utils/supports/independent-transforms"

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

/**
 * Independent transforms (x, scale, rotate etc) accelerate via the individual
 * translate, scale and rotate CSS properties. This is only possible when the
 * element renders its transform through Motion's own pipeline: layout
 * animations and transformTemplate compose the transform shorthand
 * themselves, and an optimised appear animation is still writing it.
 */
interface TransformOwner extends Owner, Partial<WithAppearProps> {
    latestValues: ResolvedValues
    projection?: { options: { layout?: boolean | string; layoutId?: string } }
}

function canAccelerateTransform(owner: TransformOwner, name: string) {
    const { projection, current, latestValues } = owner

    return (
        current instanceof HTMLElement &&
        !(
            projection &&
            (projection.options.layout || projection.options.layoutId)
        ) &&
        !(
            owner.props &&
            window.MotionHasOptimisedAnimation?.(
                getOptimisedAppearId(owner as WithAppearProps),
                name
            )
        ) &&
        canUseIndependentTransforms(latestValues, name)
    )
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

    /**
     * Most values can't be accelerated at all, so check the name before
     * looking at the element or its props.
     */
    if (
        !name ||
        !(
            acceleratedValues.has(name) ||
            colorProperties.has(name) ||
            independentTransformProperty[name]
        )
    ) {
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

    const owner = motionValue!.owner!
    const { onUpdate, transformTemplate } = owner.getProps()

    return (
        supportsWaapi() &&
        /**
         * Force WAAPI for color properties with browser-only color formats
         * (oklch, oklab, lab, lch, etc.) that the JS animation path can't parse.
         */
        (acceleratedValues.has(name) ||
            (colorProperties.has(name) && hasBrowserOnlyColors(keyframes)) ||
            (Boolean(independentTransformProperty[name]) &&
                supportsIndependentTransforms() &&
                !transformTemplate &&
                canAccelerateTransform(owner as TransformOwner, name))) &&
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
