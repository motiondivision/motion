import { Feature } from "../../motion/features/Feature"
import type { VisualElement } from "../../render/VisualElement"
import { noop } from "motion-utils"
import { VisualElementDragControls } from "./VisualElementDragControls"

export class DragGesture extends Feature<HTMLElement> {
    controls: VisualElementDragControls

    removeGroupControls: Function = noop
    removeListeners: Function = noop

    constructor(node: VisualElement<HTMLElement>) {
        super(node)
        this.controls = new VisualElementDragControls(node)
    }

    mount() {
        // If we've been provided a DragControls for manual control over the drag gesture,
        // subscribe this component to it on mount.
        const { dragControls } = this.node.getProps()

        if (dragControls) {
            this.removeGroupControls = dragControls.subscribe(this.controls)
        }

        this.removeListeners = this.controls.addListeners() || noop
    }

    unmount() {
        this.removeGroupControls()
        this.removeListeners()
    }
}
