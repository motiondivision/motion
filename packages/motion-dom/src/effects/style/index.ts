import { isCSSVar } from "../../render/dom/is-css-var"
import { transformProps } from "../../render/utils/keys-transform"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState, slotBase } from "../MotionValueState"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import {
    buildTransform,
    buildTransformOrigin,
    renderTransform,
    renderTransformOrigin,
} from "./transform"

export const originProps = new Set(["originX", "originY", "originZ"])

/**
 * Render a single non-composed style value from state.latest.
 */
export function renderStyleValue(
    element: HTMLElement | SVGElement,
    key: string,
    state: MotionValueState
) {
    if (isCSSVar(key)) {
        element.style.setProperty(key, state.latest[key] as string)
    } else {
        element.style[key as any] = getValueAsType(
            state.latest[key],
            numberValueTypes[key]
        ) as string
    }
}

/**
 * Create the composed `transform` slot for an element, if one
 * doesn't already exist.
 */
export const addTransformSlot = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    isSVG?: boolean
) => {
    if (state.get("transform")) return

    state.set(
        "transform",
        new MotionValue("none"),
        () => renderTransform(element, state, isSVG),
        undefined,
        false
    )

    state.contribute("transform", slotBase, ({ latest }) =>
        buildTransform(latest)
    )
}

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    let render: VoidFunction | undefined = undefined
    let computed: MotionValue | undefined = undefined

    if (transformProps.has(key)) {
        addTransformSlot(element, state)

        computed = state.get("transform")
    } else if (originProps.has(key)) {
        if (!state.get("transformOrigin")) {
            state.set(
                "transformOrigin",
                new MotionValue(""),
                () => renderTransformOrigin(element, state),
                undefined,
                false
            )

            state.contribute("transformOrigin", slotBase, ({ latest }) =>
                buildTransformOrigin(latest)
            )
        }

        computed = state.get("transformOrigin")
    } else {
        render = () => renderStyleValue(element, key, state)
    }

    return state.set(key, value, render, computed)
}

export const styleEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addStyleValue)
)
