import { frame } from "../../frameloop"
import { isCSSVar } from "../../render/dom/is-css-var"
import { transformProps } from "../../render/utils/keys-transform"
import { ResolvedValues } from "../../render/types"
import { MotionValue } from "../../value"
import { renderAttrValue } from "../attr"
import { MotionValueState, slotBase } from "../MotionValueState"
import {
    addStyleValue,
    addTransformSlot,
    originProps,
    renderStyleValue,
} from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

export function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}

/**
 * Render a single non-composed SVG value from state.latest, routing to
 * styles or attributes. Shared by granular value renderers and full
 * re-renders.
 */
export function renderSVGValue(
    element: SVGElement,
    state: MotionValueState,
    key: string
) {
    if (key.startsWith("attr")) {
        // Track state under the original attrX-style key so transform values
        // of the same name can coexist, but render to the unprefixed attribute
        renderAttrValue(element, state, key, convertAttrKey(key))
    } else if (isCSSVar(key) || key in element.style) {
        renderStyleValue(element, key, state)
    } else {
        renderAttrValue(element, state, key)
    }
}

export const buildDasharray = (latest: ResolvedValues) => {
    const { pathLength = 1, pathSpacing = 1 } = latest

    // Use unitless values to avoid Safari zoom bug
    return `${pathLength} ${pathSpacing}`
}

export const renderPathOffset = (
    element: SVGElement,
    state: MotionValueState
) =>
    // Use unitless value to avoid Safari zoom bug
    element.setAttribute(
        "stroke-dashoffset",
        `${-(state.latest.pathOffset ?? 0)}`
    )

function addSVGPathValue(
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) {
    frame.render(() => element.setAttribute("pathLength", "1"))

    if (key === "pathOffset") {
        return state.set(key, value, () => renderPathOffset(element, state))
    } else {
        if (!state.get("stroke-dasharray")) {
            state.set(
                "stroke-dasharray",
                new MotionValue("1 1"),
                () => {
                    // Default the offset when pathOffset isn't bound
                    if (state.latest.pathOffset === undefined) {
                        renderPathOffset(element, state)
                    }

                    element.setAttribute(
                        "stroke-dasharray",
                        state.build("stroke-dasharray") as string
                    )
                },
                undefined,
                false
            )

            state.contribute("stroke-dasharray", slotBase, ({ latest }) =>
                buildDasharray(latest)
            )
        }

        return state.set(key, value, undefined, state.get("stroke-dasharray"))
    }
}

export const addSVGValue = (
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    /**
     * Transforms and origins always render as styles - `x` etc refer to
     * translations, the attr prefix targets the equivalent attributes.
     * Checked before path values as `pathRotation` is a transform.
     */
    if (transformProps.has(key) || originProps.has(key)) {
        // Create the slot here to assert SVG rendering - the element may
        // live in the HTML namespace, where instance checks misreport it
        transformProps.has(key) && addTransformSlot(element, state, true)
        return addStyleValue(element, state, key, value)
    } else if (key.startsWith("path")) {
        return addSVGPathValue(element, state, key, value)
    }

    return state.set(key, value, () => renderSVGValue(element, state, key))
}

export const svgEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addSVGValue)
)
