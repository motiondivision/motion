import { frame, hover } from "motion-dom"
import { extractEventInfo } from "../events/event-info"
import { Feature } from "../motion/features/Feature"
import type { VisualElement } from "../render/VisualElement"

function handleHoverEvent(
    node: VisualElement<Element>,
    event: PointerEvent,
    lifecycle: "Start" | "End"
) {
    const { props } = node

    if (node.animationState && props.whileHover) {
        node.animationState.setActive("whileHover", lifecycle === "Start")
    }

    const eventName = ("onHover" + lifecycle) as "onHoverStart" | "onHoverEnd"
    const callback = props[eventName]
    if (callback) {
        frame.postRender(() => callback(event, extractEventInfo(event)))
    }
}

export class HoverGesture extends Feature<Element> {
    mount() {
        const { current } = this.node
        if (!current) return

        this.unmount = hover(current, (_element, startEvent) => {
            handleHoverEvent(this.node, startEvent, "Start")

            return (endEvent) => handleHoverEvent(this.node, endEvent, "End")
        })
    }

    unmount() {}
}
