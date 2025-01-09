import { MotionProps } from "../../../motion/types"
import { isMotionValue } from "../../../value/utils/is-motion-value"
import type { VisualElement } from "../../VisualElement"
import { transformPropOrder } from "../../html/utils/keys-transform"
import { scrapeMotionValuesFromProps as scrapeHTMLMotionValuesFromProps } from "../../html/utils/scrape-motion-values"

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
