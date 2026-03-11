import { Feature, type VisualElement } from "motion-dom"
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

    update() {
        const { dragControls } = this.node.getProps()
        const { dragControls: prevDragControls } = this.node.prevProps || {}

        if (dragControls !== prevDragControls) {
            this.removeGroupControls()
            if (dragControls) {
                this.removeGroupControls = dragControls.subscribe(this.controls)
            }
        }
    }

    unmount() {
        this.removeGroupControls()
        this.removeListeners()
        /**
         * In React 19, during list reorder reconciliation, components may
         * briefly unmount and remount while the drag is still active. If we're
         * actively dragging, we should NOT end the pan session - it will
         * continue tracking pointer events via its window-level listeners.
         *
         * The pan session will be properly cleaned up when:
         * 1. The drag ends naturally (pointerup/pointercancel)
         * 2. The component is truly removed from the DOM
         */
        if (!this.controls.isDragging) {
            this.controls.endPanSession()
        }
    }
}
