import { isMotionValue } from "motion-dom"
import type { IsValidProp } from "../../../context/MotionConfigContext"
import type { MotionProps } from "../../../motion/types"
import { isValidMotionProp } from "../../../motion/utils/valid-prop"

function shouldForward(key: string, isValidProp?: IsValidProp) {
    return key.startsWith("on")
        ? !isValidMotionProp(key)
        : isValidProp?.(key) ?? !isValidMotionProp(key)
}

export function filterProps(
    props: MotionProps,
    isDom: boolean,
    forwardMotionProps: boolean,
    isValidProp?: IsValidProp
) {
    const filteredProps: MotionProps = {}

    for (const key in props) {
        /**
         * values is considered a valid prop by Emotion, so if it's present
         * this will be rendered out to the DOM unless explicitly filtered.
         *
         * We check the type as it could be used with the `feColorMatrix`
         * element, which we support.
         */
        if (key === "values" && typeof props.values === "object") continue

        if (isMotionValue(props[key as keyof typeof props])) continue

        if (
            shouldForward(key, isValidProp) ||
            (forwardMotionProps === true && isValidMotionProp(key)) ||
            (!isDom && !isValidMotionProp(key)) ||
            // If trying to use native HTML drag events, forward drag listeners
            (props["draggable" as keyof MotionProps] &&
                key.startsWith("onDrag"))
        ) {
            filteredProps[key as keyof MotionProps] =
                props[key as keyof MotionProps]
        }
    }

    return filteredProps
}
