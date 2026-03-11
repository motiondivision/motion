import {
    HTMLVisualElement,
    isSVGElement,
    isSVGSVGElement,
    ObjectVisualElement,
    SVGVisualElement,
    visualElementStore,
} from "motion-dom"

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
