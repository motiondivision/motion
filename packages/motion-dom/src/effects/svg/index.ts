import { frame } from "../../frameloop"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { cssStyleProperties } from "../../render/svg/utils/build-attrs"
import { transformProps } from "../../render/utils/keys-transform"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { addAttrValue } from "../attr"
import { MotionValueState } from "../MotionValueState"
import { addStyleValue, readStyleValue } from "../style"
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
            const offset = value.get()
            element.setAttribute("stroke-dashoffset", `${-offset}`)
        })
    } else {
        if (!state.get("stroke-dasharray")) {
            state.set("stroke-dasharray", new MotionValue("1 1"), () => {
                const pathLength = state.get("pathLength")?.get() ?? 1
                const pathSpacing = state.get("pathSpacing")?.get()

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

export const addSVGValue = (
    element: SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    if (key.startsWith("path")) {
        return addSVGPathValue(element, state, key, value)
    } else if (key.startsWith("attr")) {
        return addAttrValue(element, state, key, value, convertAttrKey(key))
    }

    const handler = key in element.style ? addStyleValue : addAttrValue
    return handler(element, state, key, value)
}

/**
 * Reads the current value of `key` from an SVG element as the origin of
 * an animation, as the SVG VisualElement does: transforms start from
 * their defaults, the few CSS-only properties come from computed style
 * and everything else is read from the attribute, dash-cased
 * (`strokeWidth` -> `stroke-width`) or, failing that, as written
 * (`baseFrequency`).
 */
export const readSVGValue = (element: SVGElement, key: string) => {
    if (transformProps.has(key)) {
        return numberValueTypes[key]?.default || 0
    }

    if (cssStyleProperties.includes(key)) {
        return readStyleValue(element, key)
    }

    key = convertAttrKey(key)

    return (
        element.getAttribute(camelToDash(key)) ??
        element.getAttribute(key) ??
        undefined
    )
}

/**
 * The per-element effect `animate()` binds through, so SVG values share
 * state with a direct `svgEffect()` call.
 */
export const svgSubjectEffect = /*@__PURE__*/ createEffect(addSVGValue, {
    test: isSVGElement,
    read: readSVGValue,
})

export const svgEffect = /*@__PURE__*/ createSelectorEffect(svgSubjectEffect)

function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
