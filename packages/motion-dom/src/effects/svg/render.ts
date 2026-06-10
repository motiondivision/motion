import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { transformProps } from "../../render/utils/keys-transform"
import { AnyResolvedKeyframe } from "../../animation/types"
import { MotionValueState } from "../MotionValueState"
import { originProps, renderStyleValue } from "../style"
import { buildTransform, buildTransformOrigin } from "../style/transform"
import { convertAttrKey } from "./index"

function setAttribute(
    element: SVGElement,
    name: string,
    value: AnyResolvedKeyframe | undefined
) {
    if (value === null || value === undefined) {
        element.removeAttribute(name)
    } else {
        element.setAttribute(name, String(value))
    }
}

/**
 * Synchronously render every value in state.latest to the element. The SVG
 * counterpart of renderStyles, routing values to styles or attributes with
 * the same rules as addSVGValue.
 */
export function renderSVGValues(element: SVGElement, state: MotionValueState) {
    const { latest } = state
    let hasTransform = false
    let hasOrigin = false
    let hasPath = false

    for (const key in latest) {
        if (key.startsWith("path")) {
            hasPath = true
        } else if (key.startsWith("attr")) {
            setAttribute(element, convertAttrKey(key), latest[key])
        } else if (transformProps.has(key)) {
            hasTransform = true
        } else if (originProps.has(key)) {
            hasOrigin = true
        } else if (key in element.style) {
            renderStyleValue(element, key, state)
        } else {
            const name =
                key.startsWith("data") || key.startsWith("aria")
                    ? camelToDash(key)
                    : key
            setAttribute(element, name, latest[key])
        }
    }

    if (hasTransform && !latest.transform) {
        element.style.transform = (state.build("transform") ??
            buildTransform(latest)) as string

        /**
         * SVG transforms are normalised against the element's bounding box
         * with fill-box, unless otherwise provided.
         */
        if (latest.transformBox === undefined) {
            element.style.transformBox = "fill-box"
        }
    }

    if (hasOrigin) {
        element.style.transformOrigin = (state.build("transformOrigin") ??
            buildTransformOrigin(latest)) as string
    } else if (hasTransform) {
        // SVG transform-origin uses the element's median with fill-box
        element.style.transformOrigin = "50% 50%"
    }

    if (hasPath && latest.pathLength !== undefined) {
        element.setAttribute("pathLength", "1")

        // Use unitless values to avoid Safari zoom bug
        element.setAttribute(
            "stroke-dashoffset",
            `${-(latest.pathOffset ?? 0)}`
        )

        const { pathLength = 1, pathSpacing = 1 } = latest
        element.setAttribute(
            "stroke-dasharray",
            (state.build("stroke-dasharray") ??
                `${pathLength} ${pathSpacing}`) as string
        )
    }
}
