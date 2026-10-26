import { addPinchListeners, Feature, type PinchValues } from "motion-dom"

const valueKeys = ["scale", "rotate", "x", "y"]

export class PinchGesture extends Feature<Element> {
    mount() {
        const { current } = this.node
        if (!current)
            return /**
             * Stop touches panning or zooming the page. Set here rather than
             * when rendering, so the default bundle doesn't pay for it.
             */
        ;(current as HTMLElement).style.touchAction = "none"

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

    unmount() {}
}
