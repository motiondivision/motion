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

/**
 * `name` is the attribute written when it differs from the key the value
 * is stored under, e.g. `attrX` -> `x`. Numbers take the attribute's
 * default unit (`x: 100` -> `"100px"`), as they do when key and name match.
 */
export const addAttrValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue,
    name: string = key
) => {
    const isProp = canSetAsProperty(element, name)
    if (!isProp && (name.startsWith("data") || name.startsWith("aria"))) {
        name = camelToDash(name)
    }

    const type = numberValueTypes[key] || numberValueTypes[name]

    /**
     * Set attribute directly via property if available
     */
    const render = isProp
        ? () => {
              ;(element as any)[name] = getValueAsType(
                  value.get(),
                  numberValueTypes[key]
              )
          }
        : () => {
              const v = getValueAsType(value.get(), type)
              if (v === null || v === undefined) {
                  element.removeAttribute(name)
              } else {
                  element.setAttribute(name, String(v))
              }
          }

    return state.set(key, value, render)
}

export const attrEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addAttrValue)
)
