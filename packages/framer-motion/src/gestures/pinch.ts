import { addPinchListeners, Feature, type PinchValues } from "motion-dom"

const valueKeys = ["scale", "rotate", "x", "y"]

export class PinchGesture extends Feature<Element> {
    private touchAction = ""

    mount() {
        const { current } = this.node
        if (!current) return

        this.touchAction = (current as HTMLElement).style.touchAction
        this.update()

        this.unmount = addPinchListeners(
            current,
            () =>
                valueKeys.map((key) =>
                    this.node.getValue(key, key === "scale" ? 1 : 0)
                ) as PinchValues,
            () => {
                const { pinch } = this.node.getProps()
                return pinch && (pinch === true ? {} : pinch)
            }
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
