import { isHTMLElement } from "motion-dom"

export function calcInset(element: Element, container: Element) {
    const inset = { x: 0, y: 0 }

    let current: Element | null = element
    while (current && current !== container) {
        if (isHTMLElement(current)) {
            inset.x += current.offsetLeft
            inset.y += current.offsetTop
            current = current.offsetParent
        } else if (current.tagName === "svg") {
            /**
             * This isn't an ideal approach to measuring the offset of <svg /> tags.
             * It would be preferable, given they behave like HTMLElements in most ways
             * to use offsetLeft/Top. But these don't exist on <svg />. Likewise we
             * can't use .getBBox() like most SVG elements as these provide the offset
             * relative to the SVG itself, which for <svg /> is usually 0x0.
             */
            const svgBoundingBox = current.getBoundingClientRect()
            current = current.parentElement!
            const parentBoundingBox = current.getBoundingClientRect()
            inset.x += svgBoundingBox.left - parentBoundingBox.left
            inset.y += svgBoundingBox.top - parentBoundingBox.top
        } else if (current instanceof SVGGraphicsElement) {
            const { x, y } = current.getBBox()
            inset.x += x
            inset.y += y

            let svg: SVGElement | null = null
            let parent: SVGElement = current.parentNode as SVGElement
            while (!svg) {
                if (parent.tagName === "svg") {
                    svg = parent
                }
                parent = current.parentNode as SVGElement
            }
            current = svg
        } else {
            break
        }
    }

    return inset
}
