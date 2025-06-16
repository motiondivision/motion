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

/**
 * Emotion and Styled Components both allow users to pass through arbitrary props to their components
 * to dynamically generate CSS. They both use the `@emotion/is-prop-valid` package to determine which
 * of these should be passed to the underlying DOM node.
 *
 * However, when styling a Motion component `styled(motion.div)`, both packages pass through *all* props
 * as it's seen as an arbitrary component rather than a DOM node. Motion only allows arbitrary props
 * passed through the `custom` prop so it doesn't *need* the payload or computational overhead of
 * `@emotion/is-prop-valid`, however to fix this problem we need to use it.
 *
 * By making it an optionalDependency we can offer this functionality only in the situations where it's
 * actually required.
 */
try {
    /**
     * We attempt to import this package but require won't be defined in esm environments, in that case
     * isPropValid will have to be provided via `MotionContext`. In a 6.0.0 this should probably be removed
     * in favour of explicit injection.
     */
    loadExternalIsValidProp(require("@emotion/is-prop-valid").default)
} catch {
    // We don't need to actually do anything here - the fallback is the existing `isPropValid`.
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
