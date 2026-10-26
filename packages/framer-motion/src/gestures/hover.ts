import {
    extractEventInfo,
    Feature,
    frame,
    hover,
    type VisualElement,
} from "motion-dom"

/**
 * Toggle `while{gesture}` and fire `on{gesture}{lifecycle}`, e.g.
 * `onHoverStart` or, with an empty lifecycle, `onTap`.
 */
export function handleGestureEvent(
    node: VisualElement<Element>,
    event: PointerEvent,
    gesture: "Hover" | "Tap",
    lifecycle: "Start" | "End" | "Cancel" | ""
) {
    const { props } = node
    const whileKey = ("while" + gesture) as "whileHover" | "whileTap"

    if (node.animationState && props[whileKey]) {
        node.animationState.setActive(whileKey, lifecycle === "Start")
    }

    const callback = props[("on" + gesture + lifecycle) as "onHoverStart"] as
        | ((event: PointerEvent, info: any) => void)
        | undefined
    if (callback) {
        frame.postRender(() => callback(event, extractEventInfo(event)))
    }
}

export class HoverGesture extends Feature<Element> {
    mount() {
        const { current } = this.node
        if (!current) return

        this.unmount = hover(current, (_element, startEvent) => {
            handleGestureEvent(this.node, startEvent, "Hover", "Start")

            return (endEvent) =>
                handleGestureEvent(this.node, endEvent, "Hover", "End")
        })
    }

    unmount() {}
}
