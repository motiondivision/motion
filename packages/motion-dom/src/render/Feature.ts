import type { VisualElement } from "./VisualElement"

/**
 * Feature base class for extending VisualElement functionality.
 * Features are plugins that can be mounted/unmounted to add behavior
 * like gestures, animations, or layout tracking.
 */
export abstract class Feature<T extends any = any> {
    isMounted = false

    node: VisualElement<T>

    constructor(node: VisualElement<T>) {
        this.node = node
    }

    abstract mount(): void

    abstract unmount(): void

    update(): void {}
}
