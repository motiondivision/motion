/**
 * Feature base class for extending VisualElement functionality.
 * Features are plugins that can be mounted/unmounted to add behavior
 * like gestures, animations, or layout tracking.
 */
export abstract class Feature<_T extends any = any> {
    isMounted = false

    /**
     * A reference to the VisualElement this feature is attached to.
     * Typed as any to avoid circular dependencies - will be a VisualElement at runtime.
     */
    node: any

    constructor(node: any) {
        this.node = node
    }

    abstract mount(): void

    abstract unmount(): void

    update(): void {}
}
