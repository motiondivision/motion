import { createBox, ResolvedValues, VisualElement } from "motion-dom"
import { MotionProps, MotionStyle } from "../../../motion/types"

export class StateVisualElement extends VisualElement<
    ResolvedValues,
    {},
    { initialState: ResolvedValues }
> {
    type: "state"
    build() {}
    measureInstanceViewportBox = createBox
    removeValueFromRenderState() {}
    renderInstance() {}
    scrapeMotionValuesFromProps() {
        return {}
    }

    sortInstanceNodePosition() {
        return 0
    }

    getBaseTargetFromProps(props: MotionProps, key: string) {
        return props.style
            ? (props.style[key as keyof MotionStyle] as any)
            : undefined
    }

    readValueFromInstance(
        _state: {},
        key: string,
        options: { initialState: ResolvedValues }
    ) {
        return options.initialState[key] || 0
    }
}
