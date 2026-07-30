import { transformProps } from "../../render/utils/keys-transform"
import { MotionValueState } from "../MotionValueState"
import { originProps, renderStyleValue } from "./index"
import { renderTransform, renderTransformOrigin } from "./transform"

/**
 * Synchronously render every style in state.latest to the element. Used
 * for full re-renders, e.g. when measuring values or rendering projection.
 *
 * This includes values without bound renderers, e.g. those set via
 * setStaticValue() during measurement flows.
 */
export function renderStyles(
    element: HTMLElement | SVGElement,
    state: MotionValueState
) {
    const { latest } = state
    let hasTransform = false
    let hasOrigin = false

    for (const key in latest) {
        if (transformProps.has(key)) {
            hasTransform = true
        } else if (originProps.has(key)) {
            hasOrigin = true
        } else {
            renderStyleValue(element, key, state)
        }
    }

    /**
     * A user-provided `transform` value takes precedence over individual
     * transform values, matching buildHTMLStyles semantics.
     */
    if (hasTransform && !latest.transform) {
        renderTransform(element, state)
    }

    if (hasOrigin) {
        renderTransformOrigin(element, state)
    }
}
