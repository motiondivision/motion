import {
    createAnimationState,
    Feature,
    isAnimationControls,
    animateVisualElement,
    type VisualElement,
} from "motion-dom"

/**
 * Creates the animate function that will be used by the animation state
 * to perform actual animations using framer-motion's animation system.
 */
function makeAnimateFunction(visualElement: VisualElement) {
    return (animations: Array<{ animation: any; options?: any }>) => {
        return Promise.all(
            animations.map(({ animation, options }) =>
                animateVisualElement(visualElement, animation, options)
            )
        )
    }
}

export class AnimationFeature extends Feature<unknown> {
    unmountControls?: () => void

    /**
     * We dynamically generate the AnimationState manager as it contains a reference
     * to the underlying animation library. We only want to load that if we load this,
     * so people can optionally code split it out using the `m` component.
     */
    constructor(node: VisualElement) {
        super(node)
        node.animationState ||= createAnimationState(node, makeAnimateFunction)
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
        const { animate } = this.node.getProps()
        const { animate: prevAnimate } = this.node.prevProps || {}
        if (animate !== prevAnimate) {
            this.updateAnimationControlsSubscription()
        }
    }

    unmount() {
        this.node.animationState!.reset()
        this.unmountControls?.()
    }
}
