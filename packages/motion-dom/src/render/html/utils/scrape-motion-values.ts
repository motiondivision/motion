import { isMotionValue } from "../../../value/utils/is-motion-value"
import type { MotionNodeOptions } from "../../../node/types"
import { isForcedMotionValue } from "../../utils/is-forced-motion-value"
import type { VisualElement } from "../../VisualElement"

export function scrapeMotionValuesFromProps(
    props: MotionNodeOptions,
    prevProps: MotionNodeOptions,
    visualElement?: VisualElement
) {
    const style = (props as any).style
    const prevStyle = (prevProps as any)?.style
    const newValues: { [key: string]: any } = {}

    if (!style) return newValues

    for (const key in style) {
        if (
            isMotionValue(style[key]) ||
            (prevStyle && isMotionValue(prevStyle[key])) ||
            isForcedMotionValue(key, props) ||
            visualElement?.getValue(key)?.liveStyle !== undefined
        ) {
            newValues[key] = style[key]
        }
    }

    return newValues
}
