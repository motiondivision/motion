import {
    createAnimationState,
    Feature,
    isAnimationControls,
    type VisualElement,
} from "motion-dom"

export class AnimationFeature extends Feature<unknown> {
    unmountControls?: () => void

    /**
     * We dynamically generate the AnimationState manager as it contains a reference
     * to the underlying animation library. We only want to load that if we load this,
     * so people can optionally code split it out using the `m` component.
     */
    constructor(node: VisualElement) {
        super(node)
        node.animationState ||= createAnimationState(node)
    }

    updateAnimationControlsSubscription() {
        const { animate } = this.node.getProps()
        if (isAnimationControls(animate)) {
            this.unmountControls = animate.subscribe(this.node)
        }
    }

    /**
     * Subscribe any provided AnimationControls to the component's VisualElement
     */
    mount() {
        this.updateAnimationControlsSubscription()
    }

    update() {
        if (this.node.getProps().animate !== this.node.prevProps?.animate) {
            this.updateAnimationControlsSubscription()
        }
    }

    unmount() {
        this.node.animationState!.reset()
        this.unmountControls?.()
    }
}
