import { frame } from "../../frameloop"
import { transformProps } from "../../render/utils/keys-transform"
import { MotionValue } from "../../value"
import { addAttrValue } from "../attr"
import { MotionValueState, slotBase } from "../MotionValueState"
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
        return state.set(key, value, () => {
            // Use unitless value to avoid Safari zoom bug
            element.setAttribute("stroke-dashoffset", `${-state.latest[key]}`)
        })
    } else {
        if (!state.get("stroke-dasharray")) {
            state.set(
                "stroke-dasharray",
                new MotionValue("1 1"),
                () => {
                    // Default the offset when pathOffset isn't bound
                    if (state.latest.pathOffset === undefined) {
                        element.setAttribute("stroke-dashoffset", "0")
                    }

                    element.setAttribute(
                        "stroke-dasharray",
                        state.build("stroke-dasharray") as string
                    )
                },
                undefined,
                false
            )

            state.contribute("stroke-dasharray", slotBase, ({ latest }) => {
                const { pathLength = 1, pathSpacing = 1 } = latest

                // Use unitless values to avoid Safari zoom bug
                return `${pathLength} ${pathSpacing}`
            })
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
    if (key.startsWith("path")) {
        return addSVGPathValue(element, state, key, value)
    } else if (key.startsWith("attr")) {
        // Track state under the original attrX-style key so transform values
        // of the same name can coexist, but render to the unprefixed attribute
        return addAttrValue(element, state, key, value, convertAttrKey(key))
    }

    /**
     * Transforms and origins always render as styles - `x` etc refer to
     * translations, the attr prefix targets the equivalent attributes.
     */
    const handler =
        transformProps.has(key) ||
        key.startsWith("origin") ||
        key in element.style
            ? addStyleValue
            : addAttrValue
    return handler(element, state, key, value)
}

export const svgEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addSVGValue)
)

export function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
