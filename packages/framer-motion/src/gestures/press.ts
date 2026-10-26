import { Feature, press, type VisualElement } from "motion-dom"
import { handleGestureEvent } from "./hover"

function handlePressEvent(
    node: VisualElement<Element>,
    event: PointerEvent,
    lifecycle: "Start" | "" | "Cancel"
) {
    if (node.current instanceof HTMLButtonElement && node.current.disabled) {
        return
    }

    handleGestureEvent(node, event, "Tap", lifecycle)
}

export class PressGesture extends Feature<Element> {
    mount() {
        const { current } = this.node
        if (!current) return

        const { globalTapTarget, propagate } = this.node.props

        this.unmount = press(
            current,
            (_element, startEvent) => {
                handlePressEvent(this.node, startEvent, "Start")

                return (endEvent, { success }) =>
                    handlePressEvent(
                        this.node,
                        endEvent,
                        success ? "" : "Cancel"
                    )
            },
            {
                useGlobalTarget: globalTapTarget,
                stopPropagation: propagate?.tap === false,
            }
        )
    }

    unmount() {}
}
