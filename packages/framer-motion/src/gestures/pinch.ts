import {
    addPinchListeners,
    Feature,
    type OnPinchEvent,
    type PinchProps,
    type PinchValues,
} from "motion-dom"

const valueKeys = ["scale", "rotate", "x", "y"]

export class PinchGesture extends Feature<Element> {
    private touchAction = ""

    mount() {
        const { current } = this.node
        if (!current) return

        this.touchAction = (current as HTMLElement).style.touchAction
        this.update()

        /**
         * The latest enabled options. addPinchListeners reads them before
         * each step of a gesture, so they're current when a callback runs,
         * and a pinch disabled mid-way still calls its `onEnd`.
         */
        let options: PinchProps = {}

        /**
         * Call the prop's `onStart`, `onMove` or `onEnd`, so each can
         * change mid-gesture.
         */
        const call =
            (key: "onStart" | "onMove" | "onEnd"): OnPinchEvent =>
            (event, info) =>
                options[key]?.(event, info)

        this.unmount = addPinchListeners(
            current,
            () =>
                valueKeys.map((key) =>
                    this.node.getValue(key, key === "scale" ? 1 : 0)
                ) as PinchValues,
            () => {
                const { pinch } = this.node.getProps()
                return pinch && (options = pinch === true ? {} : pinch)
            },
            (_element, event, info) => (
                call("onStart")(event, info),
                { onPinch: call("onMove"), onComplete: call("onEnd") }
            )
        )
    }

    /**
     * Stop touches panning or zooming the page while pinch is on. Set here
     * rather than when rendering, so the default bundle doesn't pay for it,
     * and on every update, as React rewrites it when drag's axis changes.
     */
    update() {
        const style = (this.node.current as HTMLElement | null)?.style
        if (style) {
            style.touchAction = this.node.getProps().pinch
                ? "none"
                : this.touchAction
        }
    }

    unmount() {}
}
