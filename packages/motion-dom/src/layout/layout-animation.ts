import type { AnimationOptions } from "../animation/types"
import {
    GroupAnimation,
    type AcceptedAnimations,
} from "../animation/GroupAnimation"
import { getLayoutElements } from "./get-layout-elements"
import {
    buildProjectionTree,
    cleanupProjectionTree,
    type ProjectionContext,
    type BuildProjectionTreeOptions,
} from "./projection-tree"
import {
    resolveElements,
    type ElementOrSelector,
} from "../utils/resolve-elements"
import { frame } from "../frameloop"

interface LayoutElementRecord {
    element: HTMLElement
    options?: AnimationOptions
}

interface PendingScope {
    scope: Element | Document
    options?: AnimationOptions
}

export interface LayoutAnimationCollector {
    /**
     * Add elements to the animation queue.
     * Takes snapshot in postRender (batched with other add() calls).
     */
    add(scope: ElementOrSelector, options?: AnimationOptions): void

    /**
     * Trigger all queued animations.
     * First call runs animations, subsequent calls return same controls.
     */
    play(): Promise<GroupAnimation>

    /**
     * Reset the collector completely, clearing all state and projection nodes.
     * Only needed for complete teardown (e.g., unmounting a component tree).
     * Not required between animation cycles - the collector handles that automatically.
     */
    reset(): void
}

function createLayoutAnimationCollector(): LayoutAnimationCollector {
    let pendingScopes: PendingScope[] = []
    let pendingRecords: LayoutElementRecord[] = []
    let context: ProjectionContext | undefined
    let currentAnimation: GroupAnimation | null = null
    let snapshotScheduled = false
    let snapshotsTaken = false

    function takeSnapshots() {
        if (snapshotsTaken) return

        // Collect all elements from all pending scopes
        for (const { scope, options } of pendingScopes) {
            const elements = getLayoutElements(scope)
            for (const element of elements) {
                pendingRecords.push({ element, options })
            }
        }

        if (pendingRecords.length === 0) {
            snapshotsTaken = true
            return
        }

        // Build default options from first scope or use defaults
        const defaultTransition = pendingScopes[0]?.options || {
            duration: 0.3,
            ease: "easeOut",
        }

        const buildOptions: BuildProjectionTreeOptions = {
            defaultTransition,
        }

        // Build projection tree for all elements
        const allElements = pendingRecords.map((r) => r.element)
        context = buildProjectionTree(allElements, context, buildOptions)

        // Update transition options per element if different from default
        for (const { element, options } of pendingRecords) {
            if (options && context) {
                const node = context.nodes.get(element)
                if (node) {
                    const nodeTransition = {
                        duration: options.duration ?? 0.3,
                        ease: (options.ease ?? "easeOut") as any,
                    }
                    node.setOptions({
                        ...node.options,
                        transition: nodeTransition,
                    })
                }
            }
        }

        // Start update cycle and take snapshots
        context.root.startUpdate()

        for (const node of context.nodes.values()) {
            node.isLayoutDirty = false
            node.willUpdate()
        }

        snapshotsTaken = true
    }

    return {
        add(scope: ElementOrSelector, options?: AnimationOptions): void {
            // Resolve scope to element(s)
            const elements = resolveElements(scope)
            const resolvedScope =
                elements.length > 0 ? elements[0] : document

            pendingScopes.push({
                scope: resolvedScope instanceof Document ? resolvedScope : resolvedScope,
                options,
            })

            // Schedule snapshot for next postRender (batched)
            if (!snapshotScheduled) {
                snapshotScheduled = true
                frame.postRender(() => {
                    takeSnapshots()
                    snapshotScheduled = false
                })
            }
        },

        async play(): Promise<GroupAnimation> {
            // If no new pending scopes, return existing animation (idempotent within batch)
            if (pendingScopes.length === 0 && currentAnimation) {
                return currentAnimation
            }

            // Ensure snapshots are taken (sync if not yet done)
            if (!snapshotsTaken) {
                takeSnapshots()
            }

            // No elements to animate
            if (!context || pendingRecords.length === 0) {
                currentAnimation = new GroupAnimation([])
                // Clear pending state for next batch
                pendingScopes = []
                pendingRecords = []
                snapshotsTaken = false
                return currentAnimation
            }

            // Trigger the global update cycle
            context.root.didUpdate()

            // Wait for animations to start (postRender frame)
            await new Promise<void>((resolve) =>
                frame.postRender(() => resolve())
            )

            // Collect animations from all nodes
            const animations: AcceptedAnimations[] = []
            for (const node of context.nodes.values()) {
                if (node.currentAnimation) {
                    animations.push(node.currentAnimation)
                }
            }

            currentAnimation = new GroupAnimation(animations)

            // Clear pending state so new add() calls can queue up for next batch
            pendingScopes = []
            pendingRecords = []
            snapshotsTaken = false

            // Auto-cleanup when animation completes
            const capturedContext = context
            currentAnimation.finished.then(() => {
                // Only clean up nodes for elements no longer in the document.
                // Elements still in DOM keep their nodes so subsequent animations
                // can use the stored position snapshots (A→B→A pattern).
                const elementsToCleanup = new Set<HTMLElement>()
                for (const element of capturedContext.nodes.keys()) {
                    if (!document.contains(element)) {
                        elementsToCleanup.add(element)
                    }
                }
                cleanupProjectionTree(capturedContext, elementsToCleanup)
            })

            return currentAnimation
        },

        reset(): void {
            // Clean up existing context if any
            if (context) {
                cleanupProjectionTree(context)
            }

            pendingScopes = []
            pendingRecords = []
            context = undefined
            currentAnimation = null
            snapshotScheduled = false
            snapshotsTaken = false
        },
    }
}

/**
 * Global layout animation collector for coordinating layout animations
 * across multiple independently-registered elements.
 *
 * This API is designed for frameworks like Solid and Svelte where components
 * register themselves individually, then animations are triggered globally.
 *
 * Animations can be interrupted - calling add() and play() while an animation
 * is in progress will start a new animation from the current positions.
 * No manual reset() is required between animation cycles.
 *
 * @example
 * ```typescript
 * // Registration phase - each component registers itself
 * layoutAnimation.add(elementA, { duration: 0.3 })
 * layoutAnimation.add(elementB, { duration: 0.5 })
 * layoutAnimation.add(elementC)  // uses defaults
 *
 * // DOM changes happen (by framework or manually)
 * elementA.classList.add("moved")
 * elementB.style.left = "100px"
 *
 * // Trigger phase - one call animates everything
 * const controls = await layoutAnimation.play()
 *
 * // Subsequent play() calls within same batch return same controls
 * const sameControls = await layoutAnimation.play()  // same reference
 *
 * // New animation cycle - no reset() needed
 * layoutAnimation.add(elementA)
 * elementA.classList.remove("moved")
 * const newControls = await layoutAnimation.play()  // interrupts previous
 * ```
 */
export const layoutAnimation: LayoutAnimationCollector =
    createLayoutAnimationCollector()
