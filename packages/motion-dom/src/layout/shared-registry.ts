import { NodeStack } from "../projection/shared/stack"
import type { IProjectionNode } from "../projection/node/types"

/**
 * Global registry for shared layout IDs (document-scoped).
 * This enables shared layout animations between elements with matching
 * `data-layout-id` attributes across the entire document.
 *
 * @example
 * ```html
 * <!-- These elements will animate between each other -->
 * <div data-layout-id="hero">Item A</div>
 * <div data-layout-id="hero">Item B</div>
 * ```
 */
const sharedLayoutRegistry = new Map<string, NodeStack>()

/**
 * Register a projection node with a shared layout ID.
 * When a node with the same layoutId already exists, the new node
 * will resume from the previous lead node to create a crossfade animation.
 *
 * @param layoutId - The shared layout ID
 * @param node - The projection node to register
 * @param preserveFollowOpacity - Whether to preserve opacity during crossfade
 */
export function registerSharedLayoutNode(
    layoutId: string,
    node: IProjectionNode,
    preserveFollowOpacity?: boolean
): void {
    if (!sharedLayoutRegistry.has(layoutId)) {
        sharedLayoutRegistry.set(layoutId, new NodeStack())
    }

    const stack = sharedLayoutRegistry.get(layoutId)!
    stack.add(node)
    stack.promote(node, preserveFollowOpacity)
}

/**
 * Unregister a projection node from the shared layout registry.
 * This should be called when the element is removed from the DOM
 * or when its layout ID changes.
 *
 * @param layoutId - The shared layout ID
 * @param node - The projection node to unregister
 */
export function unregisterSharedLayoutNode(
    layoutId: string,
    node: IProjectionNode
): void {
    const stack = sharedLayoutRegistry.get(layoutId)
    if (!stack) return

    stack.remove(node)

    // Clean up empty stacks
    if (stack.members.length === 0) {
        sharedLayoutRegistry.delete(layoutId)
    }
}

/**
 * Get the NodeStack for a shared layout ID.
 * Useful for checking if a layout ID already has registered nodes.
 *
 * @param layoutId - The shared layout ID
 * @returns The NodeStack for this layout ID, or undefined if not registered
 */
export function getSharedLayoutStack(layoutId: string): NodeStack | undefined {
    return sharedLayoutRegistry.get(layoutId)
}

/**
 * Get the current lead node for a shared layout ID.
 *
 * @param layoutId - The shared layout ID
 * @returns The lead projection node, or undefined if not registered
 */
export function getSharedLayoutLead(
    layoutId: string
): IProjectionNode | undefined {
    const stack = sharedLayoutRegistry.get(layoutId)
    return stack?.lead
}

/**
 * Clear all shared layout registrations.
 * Mainly useful for testing purposes.
 */
export function clearSharedLayoutRegistry(): void {
    sharedLayoutRegistry.clear()
}

/**
 * Check if a layout ID has any registered nodes.
 *
 * @param layoutId - The shared layout ID
 * @returns True if the layout ID has registered nodes
 */
export function hasSharedLayoutNodes(layoutId: string): boolean {
    const stack = sharedLayoutRegistry.get(layoutId)
    return stack !== undefined && stack.members.length > 0
}

/**
 * Trigger exit animation complete callbacks for all nodes in a layout group.
 *
 * @param layoutId - The shared layout ID
 */
export function notifyExitAnimationComplete(layoutId: string): void {
    const stack = sharedLayoutRegistry.get(layoutId)
    if (stack) {
        stack.exitAnimationComplete()
    }
}

/**
 * Schedule render for all nodes in a shared layout group.
 *
 * @param layoutId - The shared layout ID
 */
export function scheduleSharedLayoutRender(layoutId: string): void {
    const stack = sharedLayoutRegistry.get(layoutId)
    if (stack) {
        stack.scheduleRender()
    }
}
