import { TransformPoint } from "motion-utils"
import { translateAxis } from "../geometry/delta-apply"
import { measureViewportBox } from "./measure-viewport-box"

export function measurePageBox(
    element: HTMLElement,
    rootProjectionNode: any,
    transformPagePoint?: TransformPoint
) {
    const viewportBox = measureViewportBox(element, transformPagePoint)
    const { scroll } = rootProjectionNode

    if (scroll) {
        translateAxis(viewportBox.x, scroll.offset.x)
        translateAxis(viewportBox.y, scroll.offset.y)
    }

    return viewportBox
}

export const measureDocumentScroll = () => ({
    x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
    y: document.documentElement.scrollTop || document.body?.scrollTop || 0,
})
