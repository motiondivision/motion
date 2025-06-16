import { isMotionValue, motionValue } from "motion-dom"
import { MotionStyle } from "../../motion/types"
import type { VisualElement } from "../VisualElement"

export function updateMotionValuesFromProps(
    element: VisualElement,
    next: MotionStyle,
    prev: MotionStyle
) {
    for (const key in next) {
        const nextValue = next[key as keyof MotionStyle]
        const prevValue = prev[key as keyof MotionStyle]

        if (isMotionValue(nextValue)) {
            /**
             * If this is a motion value found in props or style, we want to add it
             * to our visual element's motion value map.
             */
            element.addValue(key, nextValue)
        } else if (isMotionValue(prevValue)) {
            /**
             * If we're swapping from a motion value to a static value,
             * create a new motion value from that
             */
            element.addValue(key, motionValue(nextValue, { owner: element }))
        } else if (prevValue !== nextValue) {
            /**
             * If this is a flat value that has changed, update the motion value
             * or create one if it doesn't exist. We only want to do this if we're
             * not handling the value with our animation state.
             */
            if (element.hasValue(key)) {
                const existingValue = element.getValue(key)!

                if (existingValue.liveStyle === true) {
                    existingValue.jump(nextValue)
                } else if (!existingValue.hasAnimated) {
                    existingValue.set(nextValue)
                }
            } else {
                const latestValue = element.getStaticValue(key)
                element.addValue(
                    key,
                    motionValue(
                        latestValue !== undefined ? latestValue : nextValue,
                        { owner: element }
                    )
                )
            }
        }
    }

    // Handle removed values
    for (const key in prev) {
        if (next[key as keyof MotionStyle] === undefined)
            element.removeValue(key)
    }

    return next
}
