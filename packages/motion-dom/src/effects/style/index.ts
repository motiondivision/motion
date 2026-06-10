import { isCSSVar } from "../../render/dom/is-css-var"
import { transformProps } from "../../render/utils/keys-transform"
import { isHTMLElement } from "../../utils/is-html-element"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState, slotBase } from "../MotionValueState"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import { buildTransform, buildTransformOrigin } from "./transform"

const originProps = new Set(["originX", "originY", "originZ"])

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    let render: VoidFunction | undefined = undefined
    let computed: MotionValue | undefined = undefined

    if (transformProps.has(key)) {
        if (!state.get("transform")) {
            // If this is an HTML element, we need to set the transform-box to fill-box
            // to normalise the transform relative to the element's bounding box
            if (!isHTMLElement(element) && !state.get("transformBox")) {
                addStyleValue(
                    element,
                    state,
                    "transformBox",
                    new MotionValue("fill-box")
                )
            }

            state.set("transform", new MotionValue("none"), () => {
                element.style.transform = state.build("transform") as string
            })

            state.contribute("transform", slotBase, ({ latest }) =>
                buildTransform(latest)
            )
        }

        computed = state.get("transform")
    } else if (originProps.has(key)) {
        if (!state.get("transformOrigin")) {
            state.set("transformOrigin", new MotionValue(""), () => {
                element.style.transformOrigin = state.build(
                    "transformOrigin"
                ) as string
            })

            state.contribute("transformOrigin", slotBase, ({ latest }) =>
                buildTransformOrigin(latest)
            )
        }

        computed = state.get("transformOrigin")
    } else if (isCSSVar(key)) {
        render = () => {
            element.style.setProperty(key, state.latest[key] as string)
        }
    } else {
        render = () => {
            element.style[key as any] = getValueAsType(
                state.latest[key],
                numberValueTypes[key]
            )
        }
    }

    return state.set(key, value, render, computed)
}

export const styleEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addStyleValue)
)
