import {
    addPinchListeners,
    Feature,
    type OnPinchEvent,
    type PinchProps,
    type PinchValues,
} from "motion-dom"
import type { MotionProps } from "../motion/types"

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
            (_element, event, info) => {
                const setActive = (isActive: boolean) =>
                    this.node.animationState?.setActive("whilePinch", isActive)

                setActive(true)
                call("onStart")(event, info)

                return {
                    onPinch: call("onMove"),
                    onComplete: (event, info) => {
                        setActive(false)
                        call("onEnd")(event, info)
                    },
                }
            }
        )
    }

    /**
     * Stop touches panning or zooming the page while pinch is on, unless
     * `style` sets a `touchAction` (like "pan-y" for a list that scrolls
     * with one finger). Set here rather than when rendering, so the default
     * bundle doesn't pay for it, and on every update, as React rewrites it
     * when drag's axis changes.
     */
    update() {
        const style = (this.node.current as HTMLElement | null)?.style
        if (style) {
            const { pinch, style: props } = this.node.getProps() as MotionProps
            style.touchAction = pinch
                ? (props?.touchAction as string) || "none"
                : this.touchAction
        }
    }

    unmount() {}
}
