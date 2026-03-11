import { frame } from "../../frameloop"
import { MotionValue } from "../../value"
import { addAttrValue } from "../attr"
import { MotionValueState } from "../MotionValueState"
import { addStyleValue } from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import { isSVGTransformProperty } from "../utils/is-svg-animated-property"

function addSVGPathValue(
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) {
    frame.render(() => element.setAttribute("pathLength", "1"))

    if (key === "pathOffset") {
        return state.set(key, value, () => {
            // Use unitless value to avoid Safari zoom bug
            const offset = state.latest[key]
            element.setAttribute("stroke-dashoffset", `${-offset}`)
        })
    } else {
        if (!state.get("stroke-dasharray")) {
            state.set("stroke-dasharray", new MotionValue("1 1"), () => {
                const { pathLength = 1, pathSpacing } = state.latest

                // Use unitless values to avoid Safari zoom bug
                element.setAttribute(
                    "stroke-dasharray",
                    `${pathLength} ${pathSpacing ?? 1 - Number(pathLength)}`
                )
            })
        }

        return state.set(key, value, undefined, state.get("stroke-dasharray"))
    }
}

const addSVGValue = (
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    if (key.startsWith("path")) {
        return addSVGPathValue(element, state, key, value)
    } else if (key.startsWith("attr")) {
        return addAttrValue(element, state, convertAttrKey(key), value)
    }

    // `transform` on SVG elements is an SVGAnimatedTransformList — a complex
    // object that cannot be set directly with a string value via element.style.
    // Route it through setAttribute so SVG-syntax values (e.g. "rotate(45)"
    // without units) work correctly.
    if (isSVGTransformProperty(element, key)) {
        return addAttrValue(element, state, key, value)
    }

    const handler = key in element.style ? addStyleValue : addAttrValue
    return handler(element, state, key, value)
}

export const svgEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addSVGValue)
)

function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/u, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
