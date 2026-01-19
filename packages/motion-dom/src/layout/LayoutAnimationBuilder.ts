import { noop } from "motion-utils"
import type { AnimationOptions } from "../animation/types"
import { GroupAnimation, type AcceptedAnimations } from "../animation/GroupAnimation"
import { getLayoutElements } from "./get-layout-elements"
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

    shared(id: string, options: AnimationOptions): this {
        this.sharedTransitions.set(id, options)
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

        let context: ProjectionContext | undefined

        // Phase 1: Pre-mutation - Build projection tree and take snapshots
        const beforeElements = getLayoutElements(this.scope)

        if (beforeElements.length > 0) {
            context = buildProjectionTree(
                beforeElements,
                undefined,
                this.getBuildOptions()
            )

            context.root.startUpdate()

            for (const node of context.nodes.values()) {
                node.isLayoutDirty = false
                node.willUpdate()
            }
        }

        // Phase 2: Execute DOM update
        this.updateDom()

        // Phase 3: Post-mutation - Compare before/after elements
        const afterElements = getLayoutElements(this.scope)
        const beforeSet = new Set(beforeElements)
        const afterSet = new Set(afterElements)

        const entering = afterElements.filter((el) => !beforeSet.has(el))
        const exiting = beforeElements.filter((el) => !afterSet.has(el))

        // Build projection nodes for entering elements
        if (entering.length > 0) {
            context = buildProjectionTree(
                entering,
                context,
                this.getBuildOptions()
            )
        }

        // No layout elements - return empty animation
        if (!context) {
            this.notifyReady(new GroupAnimation([]))
            return
        }

        // Handle shared elements
        for (const element of exiting) {
            const node = context.nodes.get(element)
            node?.getStack()?.remove(node)
        }

        for (const element of entering) {
            context.nodes.get(element)?.promote()
        }

        // Phase 4: Animate
        context.root.didUpdate()

        await new Promise<void>((resolve) =>
            frame.postRender(() => resolve())
        )

        const animations: AcceptedAnimations[] = []
        for (const node of context.nodes.values()) {
            if (node.currentAnimation) {
                animations.push(node.currentAnimation)
            }
        }

        const groupAnimation = new GroupAnimation(animations)

        groupAnimation.finished.then(() => {
            // Only clean up nodes for elements no longer in the document.
            // Elements still in DOM keep their nodes so subsequent animations
            // can use the stored position snapshots (A→B→A pattern).
            const elementsToCleanup = new Set<HTMLElement>()
            for (const element of context!.nodes.keys()) {
                if (!document.contains(element)) {
                    elementsToCleanup.add(element)
                }
            }
            cleanupProjectionTree(context!, elementsToCleanup)
        })

        this.notifyReady(groupAnimation)
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
