import { isSVGElement, isSVGSVGElement, MotionNodeState } from "motion-dom"
import { HTMLVisualElement } from "../../render/html/HTMLVisualElement"
import { ObjectVisualElement } from "../../render/object/ObjectVisualElement"
import { visualElementStore } from "../../render/store"
import { SVGVisualElement } from "../../render/svg/SVGVisualElement"

export function createDOMVisualElement(element: HTMLElement | SVGElement) {
    const options = {
        presenceContext: null,
        props: {},
        state: new MotionNodeState({}),
    }
    const node =
        isSVGElement(element) && !isSVGSVGElement(element)
            ? new SVGVisualElement(options)
            : new HTMLVisualElement(options)

    node.mount(element as any)

    visualElementStore.set(element, node)
}

export function createObjectVisualElement(subject: Object) {
    const options = {
        presenceContext: null,
        props: {},
        state: new MotionNodeState({}),
    }
    const node = new ObjectVisualElement(options)

    node.mount(subject)

    visualElementStore.set(subject, node)
}
