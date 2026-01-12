import { motionValue } from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"

type MotionStyleLike = Record<string, any>

/**
 * Updates motion values from props changes.
 * Uses `any` type for element to avoid circular dependencies with VisualElement.
 */
export function updateMotionValuesFromProps(
    element: any,
    next: MotionStyleLike,
    prev: MotionStyleLike
) {
    for (const key in next) {
        const nextValue = next[key]
        const prevValue = prev[key]

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
        if (next[key] === undefined) element.removeValue(key)
    }

    return next
}
