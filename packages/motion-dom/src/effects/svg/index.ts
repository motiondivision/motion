import { frame } from "../../frameloop"
import { MotionValue } from "../../value"
import { px } from "../../value/types/numbers/units"
import { addAttrValue } from "../attr"
import { MotionValueState } from "../MotionValueState"
import { addStyleValue } from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

const toPx = px.transform!

function addSVGPathValue(
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) {
    // Check if user has set their own stroke-dasharray for styling (e.g., dashed lines).
    // If so, we shouldn't override it with our pathLength-based stroke-dasharray,
    // and we shouldn't set pathLength="1" which would change how their dash values are interpreted.
    const hasUserDasharray = element.hasAttribute("stroke-dasharray")

    if (!hasUserDasharray) {
        frame.render(() => element.setAttribute("pathLength", "1"))
    }

    if (key === "pathOffset") {
        return state.set(key, value, () =>
            element.setAttribute("stroke-dashoffset", toPx(-state.latest[key]))
        )
    } else {
        if (!hasUserDasharray && !state.get("stroke-dasharray")) {
            state.set("stroke-dasharray", new MotionValue("1 1"), () => {
                const { pathLength = 1, pathSpacing } = state.latest

                element.setAttribute(
                    "stroke-dasharray",
                    `${toPx(pathLength)} ${toPx(
                        pathSpacing ?? 1 - Number(pathLength)
                    )}`
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
