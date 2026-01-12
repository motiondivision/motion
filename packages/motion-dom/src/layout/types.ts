import type { Transition, DOMKeyframesDefinition } from "../animation/types"
import type { GroupAnimation } from "../animation/GroupAnimation"
import type { IProjectionNode, VisualElementLike } from "../projection/node/types"
import type { ElementOrSelector } from "../utils/resolve-elements"

export type { ElementOrSelector }

export interface AnimateLayoutOptions {
    /**
     * Duration of the layout animation in seconds
     */
    duration?: number

    /**
     * Easing function or preset
     */
    ease?: Transition["ease"]

    /**
     * Full transition options
     */
    transition?: Transition

    /**
     * Layout ID for shared element transitions
     */
    layoutId?: string
}

export interface EnterExitConfig {
    keyframes: DOMKeyframesDefinition
    transition?: Transition
}

export interface LayoutAnimationBuilder {
    /**
     * Define enter animation for newly added elements
     */
    enter(
        keyframes: DOMKeyframesDefinition,
        transition?: Transition
    ): LayoutAnimationBuilder

    /**
     * Define exit animation for removed elements
     */
    exit(
        keyframes: DOMKeyframesDefinition,
        transition?: Transition
    ): LayoutAnimationBuilder

    /**
     * Execute the layout animation and return a GroupAnimation
     * that implements AnimationPlaybackControls
     */
    then<T>(
        onResolve: (value: GroupAnimation) => T,
        onReject?: (err: Error) => void
    ): Promise<T>
}

/**
 * Configuration for creating projection nodes and visual elements.
 * This allows the API to work with different implementations.
 */
export interface LayoutNodeFactory {
    /**
     * Create a projection node for the given element
     */
    createProjectionNode(
        element: HTMLElement,
        parent?: IProjectionNode,
        options?: AnimateLayoutOptions
    ): IProjectionNode

    /**
     * Create a visual element for the given element
     */
    createVisualElement(
        element: HTMLElement,
        options?: AnimateLayoutOptions
    ): VisualElementLike
}

/**
 * Internal state for tracking layout animation context
 */
export interface LayoutAnimationState {
    nodes: Map<Element, IProjectionNode>
    enterConfig?: EnterExitConfig
    exitConfig?: EnterExitConfig
    options: AnimateLayoutOptions
    isExecuting: boolean
}
