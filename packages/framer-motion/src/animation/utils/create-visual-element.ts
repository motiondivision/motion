import { isSVGElement, isSVGSVGElement } from "motion-dom"
import { HTMLVisualElement } from "../../render/html/HTMLVisualElement"
import { ObjectVisualElement } from "../../render/object/ObjectVisualElement"
import { visualElementStore } from "../../render/store"
import { SVGVisualElement } from "../../render/svg/SVGVisualElement"

export function createDOMVisualElement(element: HTMLElement | SVGElement) {
    const options = {
        presenceContext: null,
        props: {},
        visualState: {
            renderState: {
                transform: {},
                transformOrigin: {},
                style: {},
                vars: {},
                attrs: {},
            },
            latestValues: {},
        },
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
        visualState: {
            renderState: {
                output: {},
            },
            latestValues: {},
        },
    }
    const node = new ObjectVisualElement(options)

    node.mount(subject)

    visualElementStore.set(subject, node)
}
