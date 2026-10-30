import {
    Feature,
    press,
    type PointerEventOptions,
    type VisualElement,
} from "motion-dom"
import { handleGestureEvent } from "./hover"

function handlePressEvent(
    node: VisualElement<Element>,
    event: PointerEvent,
    lifecycle: "Start" | "" | "Cancel",
    isRepeat?: boolean
) {
    if (node.current instanceof HTMLButtonElement && node.current.disabled) {
        return
    }

    handleGestureEvent(node, event, "Tap", lifecycle, isRepeat)
}

export class PressGesture extends Feature<Element> {
    /**
     * press() reads its options on each press, so this object is kept
     * and updated in place when props change.
     */
    private options: PointerEventOptions = {}

    mount() {
        const { current } = this.node
        if (!current) return

        this.update()

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
            this.options
        )
    }

    update() {
        const { options, node } = this
        const { globalTapTarget, propagate, tap } = node.props

        for (const key in options) delete options[key as "times"]

        Object.assign(options, tap, {
            useGlobalTarget: globalTapTarget,
            stopPropagation: propagate?.tap === false,
            onRepeat: (_element: Element, event: PointerEvent) =>
                handlePressEvent(node, event, "", true),
        })
    }

    unmount() {}
}
