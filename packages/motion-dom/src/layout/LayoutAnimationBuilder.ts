import { noop } from "motion-utils"
import type { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"
import { GroupAnimation, type AcceptedAnimations } from "../animation/GroupAnimation"
import { animateTarget } from "../animation/interfaces/visual-element-target"
import type { MutationResult, RemovedElement } from "./types"
import {
    snapshotElements,
    detectMutations,
    isRootEnteringElement,
    isRootExitingElement,
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

    private enterKeyframes?: DOMKeyframesDefinition
    private enterOptions?: AnimationOptions
    private exitKeyframes?: DOMKeyframesDefinition
    private exitOptions?: AnimationOptions
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

    enter(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this {
        this.enterKeyframes = keyframes
        this.enterOptions = options
        return this
    }

    exit(keyframes: DOMKeyframesDefinition, options?: AnimationOptions): this {
        this.exitKeyframes = keyframes
        this.exitOptions = options
        return this
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
            // Phase 1: Pre-mutation (Snapshot)
            const beforeSnapshots = snapshotElements(this.scope)
            const existingElements = Array.from(beforeSnapshots.keys())

            // Build projection tree for existing elements
            if (existingElements.length > 0) {
                context = buildProjectionTree(
                    existingElements,
                    undefined,
                    this.getBuildOptions()
                )

                // Start update cycle
                context.root.startUpdate()

                // Call willUpdate on all nodes to capture snapshots
                for (const node of context.nodes.values()) {
                    node.willUpdate()
                }
            }

            // Phase 2: Execute DOM update
            this.updateDom()

            // Phase 3: Post-mutation (Detect & Prepare)
            const mutationResult = detectMutations(beforeSnapshots, this.scope)

            // Reattach exiting elements that are NOT part of shared transitions
            // Shared elements are handled by the projection system via resumeFrom
            const nonSharedExiting = mutationResult.exiting.filter(
                ({ element }) => {
                    const layoutId = element.getAttribute("data-layout-id")
                    return !layoutId || !mutationResult.sharedEntering.has(layoutId)
                }
            )
            this.reattachExitingElements(nonSharedExiting)

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

            // Build set of shared exiting elements to exclude from animation collection
            // Their nodes are still in the tree for resumeFrom relationship, but we don't animate them
            const sharedExitingElements = new Set<HTMLElement>()
            for (const [layoutId] of mutationResult.sharedEntering) {
                const exitingElement = mutationResult.sharedExiting.get(layoutId)
                if (exitingElement) {
                    sharedExitingElements.add(exitingElement)
                }
            }

            // Phase 4: Animate
            if (context) {
                // Trigger layout animations via didUpdate
                context.root.didUpdate()

                // Wait for animations to be created (they're scheduled via frame.update)
                await new Promise<void>((resolve) => frame.postRender(() => resolve()))

                // Collect layout animations from projection nodes (excluding shared exiting elements)
                for (const [element, node] of context.nodes.entries()) {
                    if (sharedExitingElements.has(element)) continue
                    if (node.currentAnimation) {
                        animations.push(node.currentAnimation)
                    }
                }

                // Apply enter keyframes to root entering elements
                if (this.enterKeyframes) {
                    const enterAnimations = this.animateEntering(mutationResult, context)
                    animations.push(...enterAnimations)
                }

                // Apply exit keyframes to root exiting elements
                if (this.exitKeyframes) {
                    const exitAnimations = this.animateExiting(mutationResult, context)
                    animations.push(...exitAnimations)
                }
            }

            // Create and return group animation
            const groupAnimation = new GroupAnimation(animations)

            // Phase 5: Setup cleanup on complete
            groupAnimation.finished.then(() => {
                // Only clean up non-shared exiting elements (those we reattached)
                this.cleanupExitingElements(nonSharedExiting)
                if (context) {
                    cleanupProjectionTree(context)
                }
            })

            this.notifyReady(groupAnimation)
        } catch (error) {
            // Cleanup on error
            if (context) {
                cleanupProjectionTree(context)
            }
            throw error
        }
    }

    private getBuildOptions(): BuildProjectionTreeOptions {
        return {
            defaultTransition: this.defaultOptions || { duration: 0.3, ease: "easeOut" },
            sharedTransitions: this.sharedTransitions.size > 0 ? this.sharedTransitions : undefined,
        }
    }

    private reattachExitingElements(exiting: RemovedElement[]) {
        for (const { element, parentElement, nextSibling, bounds } of exiting) {
            // Check if parent still exists in DOM
            if (!parentElement.isConnected) continue

            // Reattach element
            if (nextSibling && nextSibling.parentNode === parentElement) {
                parentElement.insertBefore(element, nextSibling)
            } else {
                parentElement.appendChild(element)
            }

            // Apply absolute positioning to prevent layout shift
            const htmlElement = element as HTMLElement
            htmlElement.style.position = "absolute"
            htmlElement.style.top = `${bounds.top}px`
            htmlElement.style.left = `${bounds.left}px`
            htmlElement.style.width = `${bounds.width}px`
            htmlElement.style.height = `${bounds.height}px`
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

    private animateEntering(
        mutationResult: MutationResult,
        context: ProjectionContext
    ): AcceptedAnimations[] {
        const enteringSet = new Set(mutationResult.entering)

        // Find root entering elements
        const rootEntering = mutationResult.entering.filter((el) =>
            isRootEnteringElement(el, enteringSet)
        )

        const animations: AcceptedAnimations[] = []

        for (const element of rootEntering) {
            const visualElement = context.visualElements.get(element)
            if (!visualElement) continue

            // If entering with opacity: 1, start from opacity: 0
            const keyframes = { ...this.enterKeyframes }
            if (keyframes.opacity !== undefined) {
                const targetOpacity = Array.isArray(keyframes.opacity)
                    ? keyframes.opacity[keyframes.opacity.length - 1]
                    : keyframes.opacity

                if (targetOpacity === 1) {
                    ;(element as HTMLElement).style.opacity = "0"
                }
            }

            const options = this.enterOptions || this.defaultOptions || {}
            const enterAnims = animateTarget(visualElement, keyframes as any, {
                transitionOverride: options as any,
            })
            animations.push(...enterAnims)
        }

        return animations
    }

    private animateExiting(
        mutationResult: MutationResult,
        context: ProjectionContext
    ): AcceptedAnimations[] {
        const exitingSet = new Set(mutationResult.exiting.map((r) => r.element))

        // Find root exiting elements
        const rootExiting = mutationResult.exiting.filter((r) =>
            isRootExitingElement(r.element, exitingSet)
        )

        const animations: AcceptedAnimations[] = []

        for (const { element } of rootExiting) {
            const visualElement = context.visualElements.get(element)
            if (!visualElement) continue

            const options = this.exitOptions || this.defaultOptions || {}
            const exitAnims = animateTarget(visualElement, this.exitKeyframes as any, {
                transitionOverride: options as any,
            })
            animations.push(...exitAnims)
        }

        return animations
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
