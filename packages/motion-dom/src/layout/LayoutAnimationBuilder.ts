import { noop } from "motion-utils"
import type { AnimationOptions } from "../animation/types"
import { GroupAnimation, type AcceptedAnimations } from "../animation/GroupAnimation"
import type { RemovedElement } from "./types"
import {
    trackLayoutElements,
    getLayoutElements,
    detectMutations,
} from "./detect-mutations"
import {
    buildProjectionTree,
    cleanupProjectionTree,
    type ProjectionContext,
    type BuildProjectionTreeOptions,
} from "./projection-tree"
import { resolveElements, type ElementOrSelector } from "../utils/resolve-elements"
import { frame } from "../frameloop"

export class LayoutAnimationBuilder implements PromiseLike<GroupAnimation> {
    private scope: Element | Document
    private updateDom: () => void
    private defaultOptions?: AnimationOptions

    private sharedTransitions = new Map<string, AnimationOptions>()

    private notifyReady: (value: GroupAnimation) => void = noop
    private readyPromise: Promise<GroupAnimation>
    private executed = false

    constructor(
        scope: Element | Document,
        updateDom: () => void,
        defaultOptions?: AnimationOptions
    ) {
        this.scope = scope
        this.updateDom = updateDom
        this.defaultOptions = defaultOptions

        this.readyPromise = new Promise<GroupAnimation>((resolve) => {
            this.notifyReady = resolve
        })

        // Queue execution on microtask to allow builder methods to be called
        queueMicrotask(() => this.execute())
    }

    shared(
        layoutIdOrOptions: string | AnimationOptions,
        options?: AnimationOptions
    ): this {
        if (typeof layoutIdOrOptions === "string") {
            this.sharedTransitions.set(layoutIdOrOptions, options!)
        }
        // For now, we ignore default shared options as the projection system
        // handles shared transitions automatically
        return this
    }

    then<TResult1 = GroupAnimation, TResult2 = never>(
        onfulfilled?:
            | ((value: GroupAnimation) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return this.readyPromise.then(onfulfilled, onrejected)
    }

    private async execute() {
        if (this.executed) return
        this.executed = true

        const animations: AcceptedAnimations[] = []
        let context: ProjectionContext | undefined

        try {
            // Phase 1: Pre-mutation - Build projection tree and take snapshots
            const existingElements = getLayoutElements(this.scope)

            // Build projection tree for existing elements FIRST
            // This allows the projection system to handle measurements correctly
            if (existingElements.length > 0) {
                context = buildProjectionTree(
                    existingElements,
                    undefined,
                    this.getBuildOptions()
                )

                // Start update cycle
                context.root.startUpdate()

                // Call willUpdate on all nodes to capture snapshots via projection system
                // This handles transforms, scroll, etc. correctly
                for (const node of context.nodes.values()) {
                    // Reset isLayoutDirty so willUpdate can take a snapshot.
                    // When hasTreeAnimated is true on the global root, newly mounted nodes
                    // get isLayoutDirty=true, which causes willUpdate to skip snapshot capture.
                    node.isLayoutDirty = false
                    node.willUpdate()
                }
            }

            // Track DOM structure (parent, sibling) for detecting removals
            // No bounds measurement here - projection system already handled that
            const beforeRecords = trackLayoutElements(this.scope)

            // Phase 2: Execute DOM update
            this.updateDom()

            // Phase 3: Post-mutation (Detect & Prepare)
            const mutationResult = detectMutations(beforeRecords, this.scope)

            // Determine which exiting elements should be reattached:
            // Non-shared exiting elements (no layoutId or no matching entering/persisting element)
            const exitingToReattach = mutationResult.exiting.filter(
                ({ element }) => {
                    const layoutId = element.getAttribute("data-layout-id")
                    const isSharedWithEntering =
                        layoutId && mutationResult.sharedEntering.has(layoutId)
                    const isSharedWithPersisting =
                        layoutId && mutationResult.sharedPersisting.has(layoutId)

                    // Reattach if not a shared element
                    return !isSharedWithEntering && !isSharedWithPersisting
                }
            )
            this.reattachExitingElements(exitingToReattach, context)

            // Build projection nodes for entering elements
            if (mutationResult.entering.length > 0) {
                context = buildProjectionTree(
                    mutationResult.entering,
                    context,
                    this.getBuildOptions()
                )
            }

            // Also ensure persisting elements have nodes if context didn't exist
            if (!context && mutationResult.persisting.length > 0) {
                context = buildProjectionTree(
                    mutationResult.persisting,
                    undefined,
                    this.getBuildOptions()
                )
            }

            // Build set of shared exiting elements (they don't animate separately)
            const sharedExitingElements = new Set<HTMLElement>()

            for (const [layoutId, enteringElement] of mutationResult.sharedEntering) {
                const exitingElement = mutationResult.sharedExiting.get(layoutId)
                if (exitingElement) {
                    sharedExitingElements.add(exitingElement)

                    const exitingNode = context?.nodes.get(exitingElement)
                    const enteringNode = context?.nodes.get(enteringElement)

                    if (exitingNode && enteringNode) {
                        // Remove exiting node from stack, no crossfade
                        const stack = exitingNode.getStack()
                        if (stack) {
                            stack.remove(exitingNode)
                        }
                    } else if (exitingNode && !enteringNode) {
                        // Fallback: If entering node doesn't exist yet, just handle exiting
                        const stack = exitingNode.getStack()
                        if (stack) {
                            stack.remove(exitingNode)
                        }
                    }
                }
            }

            // Handle A -> AB -> A pattern: persisting element should become lead again
            // when exiting element with same layoutId is removed
            for (const [layoutId, persistingElement] of mutationResult.sharedPersisting) {
                const exitingElement = mutationResult.sharedExiting.get(layoutId)
                if (!exitingElement) continue

                sharedExitingElements.add(exitingElement)

                const exitingNode = context?.nodes.get(exitingElement)
                const persistingNode = context?.nodes.get(persistingElement)

                if (exitingNode && persistingNode) {
                    // Remove exiting node from stack, no crossfade
                    const stack = exitingNode.getStack()
                    if (stack) {
                        stack.remove(exitingNode)
                    }
                }
            }

            // Phase 4: Animate
            if (context) {
                // Trigger layout animations via didUpdate
                context.root.didUpdate()

                // Wait for animations to be created (they're scheduled via frame.update)
                await new Promise<void>((resolve) =>
                    frame.postRender(() => resolve())
                )

                // Collect layout animations from projection nodes
                // Skip shared exiting elements (they don't animate)
                for (const [element, node] of context.nodes.entries()) {
                    if (sharedExitingElements.has(element)) continue
                    if (node.currentAnimation) {
                        animations.push(node.currentAnimation)
                    }
                }
            }

            // Create and return group animation
            const groupAnimation = new GroupAnimation(animations)

            // Phase 5: Setup cleanup on complete
            // Only cleanup exiting elements - persisting elements keep their nodes
            // This matches React's behavior where nodes persist for elements in the DOM
            const exitingElements = new Set(
                mutationResult.exiting.map(({ element }) => element)
            )
            groupAnimation.finished.then(() => {
                // Clean up all reattached exiting elements (remove from DOM)
                this.cleanupExitingElements(exitingToReattach)
                if (context) {
                    // Only cleanup projection nodes for exiting elements
                    cleanupProjectionTree(context, exitingElements)
                }
            })

            this.notifyReady(groupAnimation)
        } catch (error) {
            // Cleanup on error - cleanup all nodes since animation failed
            if (context) {
                cleanupProjectionTree(context)
            }
            throw error
        }
    }

    private getBuildOptions(): BuildProjectionTreeOptions {
        return {
            defaultTransition: this.defaultOptions || {
                duration: 0.3,
                ease: "easeOut",
            },
            sharedTransitions:
                this.sharedTransitions.size > 0
                    ? this.sharedTransitions
                    : undefined,
        }
    }

    private reattachExitingElements(
        exiting: RemovedElement[],
        context?: ProjectionContext
    ) {
        for (const { element, parentElement, nextSibling } of exiting) {
            // Check if parent still exists in DOM
            if (!parentElement.isConnected) continue

            // Get bounds from projection node snapshot (measured correctly via projection system)
            const node = context?.nodes.get(element)
            const snapshot = node?.snapshot
            if (!snapshot) continue

            const { layoutBox } = snapshot

            // Reattach element
            if (nextSibling && nextSibling.parentNode === parentElement) {
                parentElement.insertBefore(element, nextSibling)
            } else {
                parentElement.appendChild(element)
            }

            // Apply absolute positioning to prevent layout shift
            // Use layoutBox from projection system which has transform-free measurements
            const htmlElement = element as HTMLElement
            htmlElement.style.position = "absolute"
            htmlElement.style.top = `${layoutBox.y.min}px`
            htmlElement.style.left = `${layoutBox.x.min}px`
            htmlElement.style.width = `${layoutBox.x.max - layoutBox.x.min}px`
            htmlElement.style.height = `${layoutBox.y.max - layoutBox.y.min}px`
            htmlElement.style.margin = "0"
            htmlElement.style.pointerEvents = "none"
        }
    }

    private cleanupExitingElements(exiting: RemovedElement[]) {
        for (const { element } of exiting) {
            if (element.parentElement) {
                element.parentElement.removeChild(element)
            }
        }
    }
}

/**
 * Parse arguments for animateLayout overloads
 */
export function parseAnimateLayoutArgs(
    scopeOrUpdateDom: ElementOrSelector | (() => void),
    updateDomOrOptions?: (() => void) | AnimationOptions,
    options?: AnimationOptions
): {
    scope: Element | Document
    updateDom: () => void
    defaultOptions?: AnimationOptions
} {
    // animateLayout(updateDom)
    if (typeof scopeOrUpdateDom === "function") {
        return {
            scope: document,
            updateDom: scopeOrUpdateDom,
            defaultOptions: updateDomOrOptions as AnimationOptions | undefined,
        }
    }

    // animateLayout(scope, updateDom, options?)
    const elements = resolveElements(scopeOrUpdateDom)
    const scope = elements[0] || document

    return {
        scope: scope instanceof Document ? scope : scope,
        updateDom: updateDomOrOptions as () => void,
        defaultOptions: options,
    }
}
