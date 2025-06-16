import { frame, press } from "motion-dom"
import { extractEventInfo } from "../events/event-info"
import { Feature } from "../motion/features/Feature"
import { VisualElement } from "../render/VisualElement"

function handlePressEvent(
    node: VisualElement<Element>,
    event: PointerEvent,
    lifecycle: "Start" | "End" | "Cancel"
) {
    const { props } = node

    if (node.current instanceof HTMLButtonElement && node.current.disabled) {
        return
    }

    if (node.animationState && props.whileTap) {
        node.animationState.setActive("whileTap", lifecycle === "Start")
    }

    const eventName = ("onTap" + (lifecycle === "End" ? "" : lifecycle)) as
        | "onTapStart"
        | "onTap"
        | "onTapCancel"

    const callback = props[eventName]
    if (callback) {
        frame.postRender(() => callback(event, extractEventInfo(event)))
    }
}

export class PressGesture extends Feature<Element> {
    mount() {
        const { current } = this.node
        if (!current) return

        this.unmount = press(
            current,
            (_element, startEvent) => {
                handlePressEvent(this.node, startEvent, "Start")

                return (endEvent, { success }) =>
                    handlePressEvent(
                        this.node,
                        endEvent,
                        success ? "End" : "Cancel"
                    )
            },
            { useGlobalTarget: this.node.props.globalTapTarget }
        )
    }

    unmount() {}
}
