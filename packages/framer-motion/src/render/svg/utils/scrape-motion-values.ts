import { isMotionValue, transformPropOrder } from "motion-dom"
import { MotionProps } from "../../../motion/types"
import { scrapeMotionValuesFromProps as scrapeHTMLMotionValuesFromProps } from "../../html/utils/scrape-motion-values"
import type { VisualElement } from "../../VisualElement"

export function scrapeMotionValuesFromProps(
    props: MotionProps,
    prevProps: MotionProps,
    visualElement?: VisualElement
) {
    const newValues = scrapeHTMLMotionValuesFromProps(
        props,
        prevProps,
        visualElement
    )

    for (const key in props) {
        if (
            isMotionValue(props[key as keyof typeof props]) ||
            isMotionValue(prevProps[key as keyof typeof prevProps])
        ) {
            const targetKey =
                transformPropOrder.indexOf(key) !== -1
                    ? "attr" + key.charAt(0).toUpperCase() + key.substring(1)
                    : key

            newValues[targetKey] = props[key as keyof typeof props]
        }
    }

    return newValues
}
