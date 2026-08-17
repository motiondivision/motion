import { isCSSVar } from "../../render/dom/is-css-var"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { transformProps } from "../../render/utils/keys-transform"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState, slotBase } from "../MotionValueState"
import { addStyleValue, originProps, renderStyleValue } from "../style"
import { buildTransform, buildTransformOrigin } from "../style/transform"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

const prefix = Math.random().toString(36).slice(2)
let id = 0
const varNames = new WeakMap<Element, Map<string, string>>()

const getVarName = (element: Element, key: string) => {
    let names = varNames.get(element)
    if (!names) varNames.set(element, (names = new Map()))

    let name = names.get(key)
    if (!name) {
        name = `--motion-${prefix}-${id++}`
        names.set(key, name)

        try {
            CSS.registerProperty({ name, syntax: "*", inherits: false })
        } catch {}
    }

    return name
}

const addVarSlot = (
    element: HTMLElement,
    state: MotionValueState,
    key: "transform" | "transformOrigin"
) => {
    if (state.get(key)) return

    const name = getVarName(element, key)
    element.style.setProperty(camelToDash(key), `var(${name})`)

    state.set(
        key,
        new MotionValue(""),
        () =>
            element.style.setProperty(
                name,
                (state.build(key) ??
                    (key === "transform"
                        ? buildTransform(state.latest)
                        : buildTransformOrigin(state.latest))) as string
            ),
        undefined,
        false
    )
    state.contribute(key, slotBase, ({ latest }) =>
        key === "transform"
            ? buildTransform(latest)
            : buildTransformOrigin(latest)
    )
}

export const addVarValue = (
    element: HTMLElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    if (typeof CSS === "undefined" || !CSS.registerProperty) {
        return addStyleValue(element, state, key, value)
    }

    let render: VoidFunction | undefined
    let computed: MotionValue | undefined

    if (transformProps.has(key)) {
        addVarSlot(element, state, "transform")
        computed = state.get("transform")
    } else if (originProps.has(key)) {
        addVarSlot(element, state, "transformOrigin")
        computed = state.get("transformOrigin")
    } else if (isCSSVar(key)) {
        render = () => renderStyleValue(element, key, state)
    } else {
        const name = getVarName(element, key)
        element.style.setProperty(camelToDash(key), `var(${name})`)
        render = () =>
            element.style.setProperty(
                name,
                getValueAsType(
                    state.latest[key],
                    numberValueTypes[key]
                ) as string
            )
    }

    return state.set(key, value, render, computed)
}

export const varEffect = /*@__PURE__*/ createSelectorEffect(
    /*@__PURE__*/ createEffect(addVarValue)
)
