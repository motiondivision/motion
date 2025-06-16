import { isMotionValue } from "motion-dom"
import { MotionProps, MotionStyle } from "../../../motion/types"
import { isForcedMotionValue } from "../../../motion/utils/is-forced-motion-value"
import type { VisualElement } from "../../VisualElement"

export function scrapeMotionValuesFromProps(
    props: MotionProps,
    prevProps: MotionProps,
    visualElement?: VisualElement
) {
    const { style } = props
    const newValues: { [key: string]: any } = {}

    for (const key in style) {
        if (
            isMotionValue(style[key as keyof MotionStyle]) ||
            (prevProps.style &&
                isMotionValue(prevProps.style[key as keyof MotionStyle])) ||
            isForcedMotionValue(key, props) ||
            visualElement?.getValue(key)?.liveStyle !== undefined
        ) {
            newValues[key] = style[key as keyof MotionStyle]
        }
    }

    return newValues
}
