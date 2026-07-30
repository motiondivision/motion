import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState } from "../MotionValueState"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

function canSetAsProperty(element: HTMLElement | SVGElement, name: string) {
    if (!(name in element)) return false

    const descriptor =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), name) ||
        Object.getOwnPropertyDescriptor(element, name)

    // Check if it has a setter
    return descriptor && typeof descriptor.set === "function"
}

export const getAttrName = (key: string) =>
    key.startsWith("data") || key.startsWith("aria") ? camelToDash(key) : key

/**
 * Render a single value from state.latest to an attribute.
 */
export function renderAttrValue(
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    name: string = getAttrName(key)
) {
    const value = getValueAsType(state.latest[key], numberValueTypes[key])

    if (value === null || value === undefined) {
        element.removeAttribute(name)
    } else {
        element.setAttribute(name, String(value))
    }
}

export const addAttrValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue,
    attrName: string = key
) => {
    /**
     * Set attribute directly via property if available
     */
    let render: VoidFunction
    if (canSetAsProperty(element, attrName)) {
        render = () => {
            ;(element as any)[attrName] = getValueAsType(
                state.latest[key],
                numberValueTypes[key]
            )
        }
    } else {
        const name = getAttrName(attrName)
        render = () => renderAttrValue(element, state, key, name)
    }

    return state.set(key, value, render)
}

export const attrEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addAttrValue)
)
