/**
 * Layout system initialization for vanilla (non-React) usage.
 *
 * This file provides the integration between framer-motion's concrete
 * implementations (HTMLProjectionNode, HTMLVisualElement) and motion-dom's
 * vanilla animateLayout() API.
 */

import { initLayoutSystem } from "motion-dom"
import { HTMLProjectionNode } from "../projection/node/HTMLProjectionNode"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import type { ResolvedValues } from "../render/types"
import type { HTMLRenderState } from "../render/html/types"

/**
 * Wrapper class that adapts HTMLVisualElement to the simpler factory interface
 * expected by motion-dom's layout system.
 */
class VanillaVisualElement extends HTMLVisualElement {
    constructor(options: {
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
    }) {
        super(
            {
                parent: undefined,
                props: options.props,
                presenceContext: null,
                reducedMotionConfig: undefined,
                blockInitialAnimation: false,
                visualState: options.visualState as {
                    latestValues: ResolvedValues
                    renderState: HTMLRenderState
                },
            },
            {}
        )
    }
}

/**
 * Initialize the layout animation system for vanilla (non-React) usage.
 *
 * Call this function once at app initialization to enable the animateLayout() API.
 * This is automatically called when importing from 'framer-motion/dom'.
 *
 * @example
 * ```javascript
 * import { initVanillaLayout } from 'framer-motion'
 *
 * // Initialize once at app startup
 * initVanillaLayout()
 *
 * // Now you can use animateLayout()
 * import { animateLayout } from 'motion-dom'
 *
 * animateLayout("#box", () => {
 *     box.classList.toggle("expanded")
 * }, { duration: 0.3 })
 * ```
 */
export function initVanillaLayout(): void {
    // Use 'any' to bypass type incompatibility between framer-motion and motion-dom
    // interfaces. The runtime types are compatible, but TypeScript sees them as
    // different because they're defined in different packages.
    initLayoutSystem({
        ProjectionNode: HTMLProjectionNode as any,
        VisualElement: VanillaVisualElement as any,
    })
}

// Export for convenience
export { HTMLProjectionNode, HTMLVisualElement }
