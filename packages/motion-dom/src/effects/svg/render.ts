import { transformProps } from "../../render/utils/keys-transform"
import { MotionValueState } from "../MotionValueState"
import { originProps } from "../style"
import { renderTransform, renderTransformOrigin } from "../style/transform"
import {
    buildDasharray,
    renderPathOffset,
    renderSVGValue,
} from "./index"

/**
 * Synchronously render every value in state.latest to the element. The SVG
 * counterpart of renderStyles, dispatching through the same single-value
 * renderers as addSVGValue.
 */
export function renderSVGValues(element: SVGElement, state: MotionValueState) {
    const { latest } = state
    let hasTransform = false
    let hasOrigin = false

    for (const key in latest) {
        if (transformProps.has(key)) {
            hasTransform = true
        } else if (originProps.has(key)) {
            hasOrigin = true
        } else if (!key.startsWith("path")) {
            renderSVGValue(element, state, key)
        }
    }

    if (hasTransform && !latest.transform) {
        renderTransform(element, state, true)
    }

    if (hasOrigin) {
        renderTransformOrigin(element, state)
    }

    if (latest.pathLength !== undefined) {
        // Normalise path length by setting SVG attribute pathLength to 1
        element.setAttribute("pathLength", "1")

        renderPathOffset(element, state)

        element.setAttribute(
            "stroke-dasharray",
            (state.build("stroke-dasharray") ?? buildDasharray(latest)) as string
        )
    }
}
