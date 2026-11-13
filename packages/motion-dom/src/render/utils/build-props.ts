import { getTransformRender, RenderSource } from "../../effects/style"
import type { NodeRender } from "../../node/MotionNode"
import type { ResolvedValues } from "../../node/types"

/**
 * A style that takes CSS variables as a CSSStyleDeclaration does.
 */
const styleTarget = {
    setProperty(this: ResolvedValues, name: string, value: any) {
        this[name] = value
    },
}

export interface VisualProps {
    style: ResolvedValues
    attrs: ResolvedValues
}

/**
 * The styles (and for SVG, attributes) a component renders its latest
 * values as, before it has an element. They're written by the same
 * functions that write them to the element once it has one.
 *
 * @param tagName - The tag of an SVG component. Leave out for HTML.
 */
export function buildVisualProps(
    getRender: (element: any, node: RenderSource, key: string) => NodeRender,
    latestValues: ResolvedValues,
    props: any,
    tagName?: any
): VisualProps {
    const attrs: ResolvedValues = {}

    /**
     * What the write functions use of an element. An SVG element is
     * told from an HTML one by having an `ownerSVGElement`.
     */
    const element = {
        style: Object.create(styleTarget),
        attrs,
        tagName,
        ownerSVGElement: tagName && null,
        setAttribute: (name: string, value: any) => (attrs[name] = value),
    }
    const node: RenderSource = { latestValues, getProps: () => props }

    for (const key in latestValues) {
        const render = getRender(element, node, key)
        render.shared || render()
    }

    // A transformTemplate is called even when no transform is set
    props.transformTemplate && getTransformRender(element as any, node)

    for (const name in node.shared) node.shared[name]()

    return element
}
