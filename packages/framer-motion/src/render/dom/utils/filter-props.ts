import { isMotionValue } from "motion-dom"
import type { MotionProps } from "../../../motion/types"
import { isValidMotionProp } from "../../../motion/utils/valid-prop"

let shouldForward = (key: string) => !isValidMotionProp(key)

export type IsValidProp = (key: string) => boolean

export function loadExternalIsValidProp(isValidProp?: IsValidProp) {
    if (typeof isValidProp !== "function") return

    // Explicitly filter our events
    shouldForward = (key: string) =>
        key.startsWith("on") ? !isValidMotionProp(key) : isValidProp(key)
}

export function filterProps(
    props: MotionProps,
    isDom: boolean,
    forwardMotionProps: boolean
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
            shouldForward(key) ||
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
