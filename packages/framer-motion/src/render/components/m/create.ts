import { createMotionComponent, MotionComponentOptions } from "../../../motion"
import { animations } from "../../../motion/features/animations"
import { CreateVisualElement } from "../../types"
import { DOMMotionComponents } from "../../dom/types"
import { createDomVisualElement } from "../../dom/create-visual-element"

export function createMinimalMotionComponent<
    Props,
    TagName extends keyof DOMMotionComponents | string = "div"
>(
    Component: TagName | string | React.ComponentType<Props>,
    options?: MotionComponentOptions
) {
    return createMotionComponent(
        Component,
        options,
        animations,
        createDomVisualElement as CreateVisualElement<Props, TagName>
    )
}
