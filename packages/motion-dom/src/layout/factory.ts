import type { IProjectionNode, VisualElementLike } from "../projection/node/types"
import type { AnimateLayoutOptions, LayoutNodeFactory } from "./types"
import { setLayoutNodeFactory, getLayoutNodeFactory } from "./animate-layout"
import {
    registerSharedLayoutNode,
    unregisterSharedLayoutNode,
} from "./shared-registry"

export { setLayoutNodeFactory, getLayoutNodeFactory }

/**
 * Helper to create a LayoutNodeFactory from concrete implementations.
 * This is designed to be called by framer-motion to provide the concrete
 * HTMLProjectionNode and HTMLVisualElement classes.
 */
export function createLayoutNodeFactory(config: {
    /**
     * Constructor for creating projection nodes.
     * This should be HTMLProjectionNode from framer-motion.
     */
    ProjectionNode: new (
        latestValues: Record<string, unknown>,
        parent?: IProjectionNode
    ) => IProjectionNode

    /**
     * Constructor for creating visual elements.
     * This should be HTMLVisualElement from framer-motion.
     */
    VisualElement: new (options: {
        visualState: {
            latestValues: Record<string, unknown>
            renderState: {
                transformOrigin: Record<string, unknown>
                transform: Record<string, unknown>
                style: Record<string, unknown>
                vars: Record<string, unknown>
            }
        }
        props: Record<string, unknown>
    }) => VisualElementLike
}): LayoutNodeFactory {
    const { ProjectionNode, VisualElement } = config

    return {
        createProjectionNode(
            element: HTMLElement,
            parent?: IProjectionNode,
            options: AnimateLayoutOptions = {}
        ): IProjectionNode {
            const latestValues: Record<string, unknown> = {}

            // Get layoutId from options or data attribute
            const layoutId =
                options.layoutId ?? element.dataset?.layoutId ?? undefined

            // Create visual element with minimal state
            const visualElement = new VisualElement({
                visualState: {
                    latestValues,
                    renderState: {
                        transformOrigin: {},
                        transform: {},
                        style: {},
                        vars: {},
                    },
                },
                props: {},
            })

            // Create projection node
            const node = new ProjectionNode(latestValues, parent)

            // Configure the node
            node.setOptions({
                scheduleRender: () => {
                    if (visualElement.scheduleRender) {
                        visualElement.scheduleRender()
                    }
                },
                visualElement,
                layout: true,
                layoutId,
                transition: options.transition ?? {
                    duration: options.duration ?? 0.3,
                    ease: options.ease,
                },
            })

            // Mount the node
            node.mount(element)

            // Link visual element to projection
            visualElement.projection = node

            // Register with shared layout registry if layoutId is present
            if (layoutId) {
                registerSharedLayoutNode(layoutId, node)

                // Store original unmount for cleanup
                const originalUnmount = node.unmount?.bind(node)
                node.unmount = () => {
                    unregisterSharedLayoutNode(layoutId, node)
                    if (originalUnmount) {
                        originalUnmount()
                    }
                }
            }

            // Set up animation listener
            node.addEventListener(
                "didUpdate",
                ({
                    delta,
                    hasLayoutChanged,
                }: {
                    delta: unknown
                    hasLayoutChanged: boolean
                }) => {
                    if (node.resumeFrom) {
                        node.resumingFrom = node.resumeFrom
                        if (node.resumingFrom) {
                            node.resumingFrom.resumingFrom = undefined
                        }
                    }
                    if (hasLayoutChanged) {
                        node.setAnimationOrigin(delta as any)
                        node.startAnimation(
                            options.transition ?? {
                                duration: options.duration ?? 0.3,
                                ease: options.ease,
                            }
                        )
                    }
                }
            )

            return node
        },

        createVisualElement(
            _element: HTMLElement,
            _options: AnimateLayoutOptions = {}
        ): VisualElementLike {
            // This is typically not called directly - visual elements
            // are created as part of createProjectionNode
            const latestValues: Record<string, unknown> = {}

            return new VisualElement({
                visualState: {
                    latestValues,
                    renderState: {
                        transformOrigin: {},
                        transform: {},
                        style: {},
                        vars: {},
                    },
                },
                props: {},
            })
        },
    }
}

/**
 * Initialize the layout system with framer-motion's implementations.
 * Call this function once at app initialization to enable animateLayout().
 *
 * @example
 * // In framer-motion or your app initialization
 * import { HTMLProjectionNode, HTMLVisualElement } from 'framer-motion'
 * import { initLayoutSystem } from 'motion-dom'
 *
 * initLayoutSystem({
 *     ProjectionNode: HTMLProjectionNode,
 *     VisualElement: HTMLVisualElement,
 * })
 */
export function initLayoutSystem(config: Parameters<typeof createLayoutNodeFactory>[0]): void {
    const factory = createLayoutNodeFactory(config)
    setLayoutNodeFactory(factory)
}
