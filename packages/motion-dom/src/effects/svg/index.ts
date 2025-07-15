import { frame } from "../../frameloop"
import { MotionValue } from "../../value"
import { addAttrValue } from "../attr"
import { MotionValueState } from "../MotionValueState"
import { addStyleValue } from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

function addSVGPathValue(
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) {
    frame.render(() => element.setAttribute("pathLength", "1"))

    if (key === "pathOffset") {
        const offset = state.latest[key]
        const offsetValue = typeof offset === "string" ? -parseFloat(offset) : -offset
        return state.set(key, value, () =>
            element.setAttribute("stroke-dashoffset", `${offsetValue}`)
        )
    } else {
        if (!state.get("stroke-dasharray")) {
            state.set("stroke-dasharray", new MotionValue("1 1"), () => {
                const { pathLength = 1, pathSpacing } = state.latest

                const lengthValue =
                    typeof pathLength === "string"
                        ? pathLength
                        : `${pathLength}`

                const spacingRaw = pathSpacing ?? 1 - Number(pathLength)
                const spacingValue =
                    typeof spacingRaw === "string"
                        ? spacingRaw
                        : `${spacingRaw}`

                element.setAttribute(
                    "stroke-dasharray",
                    `${lengthValue} ${spacingValue}`
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

    const handler = key in element.style ? addStyleValue : addAttrValue
    return handler(element, state, key, value)
}

export const svgEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addSVGValue)
)

function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
