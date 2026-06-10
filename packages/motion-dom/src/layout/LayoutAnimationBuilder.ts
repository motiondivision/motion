import { clamp } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import type { AnimationOptions, Transition } from "../animation/types"
import { frameData, frameSteps } from "../frameloop"
import { microtask } from "../frameloop/microtask"
import { time } from "../frameloop/sync-time"
import { HTMLProjectionNode } from "../projection/node/HTMLProjectionNode"
import type { IProjectionNode } from "../projection/node/types"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { visualElementStore } from "../render/store"
import { hasTransform } from "../projection/utils/has-transform"
import {
    resolveElements,
    type ElementOrSelector,
} from "../utils/resolve-elements"

type LayoutAnimationScope = Element | Document
type LayoutBuilderResolve = (animation: GroupAnimation) => void
type LayoutBuilderReject = (error: unknown) => void

interface RestorePoint {
    parent: Element
    next: ChildNode | null
}

const layoutSelector = "[data-layout],[data-layout-id]"

/**
 * All imperatively-created projection nodes live in one persistent tree,
 * shared across animateLayout() calls (and with any React-created nodes,
 * via the singleton document root). Keyed by element for reuse.
 */
const layoutNodes = new WeakMap<Element, IProjectionNode>()

/**
 * Builders created within the same synchronous tick are flushed together
 * as a single "commit": every node is snapshotted before any updateDom
 * runs, mirroring React batching renders from different parts of the tree.
 */
let pendingBuilders: LayoutAnimationBuilder[] | undefined

function collectLayoutElements(scope: LayoutAnimationScope): HTMLElement[] {
    const elements: HTMLElement[] = []

    if (scope instanceof HTMLElement && scope.matches(layoutSelector)) {
        elements.push(scope)
    }

    scope.querySelectorAll(layoutSelector).forEach((element) => {
        if (element instanceof HTMLElement) elements.push(element)
    })

    return elements
}

/**
 * Process any work scheduled on the frameloop now. A previous animation
 * may have been seeked while paused (controls.time = x) without a frame
 * having rendered it - we must materialise that state into the DOM
 * before taking snapshots.
 */
function flushPendingFrame() {
    if (frameData.isProcessing) return

    const now = time.now()
    frameData.delta = clamp(0, 1000 / 60, now - frameData.timestamp)
    frameData.timestamp = now
    frameData.isProcessing = true
    frameSteps.update.process(frameData)
    frameSteps.preRender.process(frameData)
    frameSteps.render.process(frameData)
    frameData.isProcessing = false
}

function getProjectionParent(element: Element): IProjectionNode | undefined {
    let ancestor = element.parentElement
    while (ancestor) {
        const node = layoutNodes.get(ancestor)
        if (node && node.instance) return node
        ancestor = ancestor.parentElement
    }
    return undefined
}

function createVisualElement() {
    return new HTMLVisualElement(
        {
            props: {},
            presenceContext: null,
            visualState: {
                latestValues: {},
                renderState: {
                    transform: {},
                    transformOrigin: {},
                    style: {},
                    vars: {},
                },
            },
        },
        { allowProjection: true }
    )
}

function readNodeOptions(element: HTMLElement, transition?: Transition) {
    const layoutAttr = element.getAttribute("data-layout")
    const layoutId = element.getAttribute("data-layout-id") ?? undefined

    return {
        layoutId,
        layout: layoutAttr !== null ? true : undefined,
        animationType: (layoutAttr || "both") as "both",
        transition,
    }
}

function prepareNode(
    element: HTMLElement,
    transition?: Transition
): IProjectionNode {
    let node = layoutNodes.get(element)

    if (!node) {
        let visualElement = visualElementStore.get(element) as
            | HTMLVisualElement
            | undefined

        if (!visualElement) visualElement = createVisualElement()

        /**
         * A first-time element may carry a projection transform in its
         * inline style (e.g. it was cloned from an element mid-animation).
         * That transform isn't tracked in latestValues so the engine can't
         * reset it before measuring - clear it now so the first layout
         * measurement isn't inflated.
         */
        if (
            element.style.transform &&
            !hasTransform(visualElement.latestValues)
        ) {
            element.style.transform = ""
        }

        node = new HTMLProjectionNode(
            visualElement.latestValues,
            getProjectionParent(element)
        )
        visualElement.projection = node

        node.setOptions({
            ...readNodeOptions(element, transition),
            visualElement,
        })
        node.mount(element)
        layoutNodes.set(element, node)
    } else {
        node.setOptions(readNodeOptions(element, transition))
    }

    node.isPresent = true
    if (node.options.onExitComplete) {
        node.setOptions({ onExitComplete: undefined })
    }

    return node
}

function sortDocumentOrder(elements: Iterable<HTMLElement>) {
    return [...elements].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
}

function dropNode(element: Element, node: IProjectionNode) {
    node.setOptions({ onExitComplete: undefined })

    /**
     * Stop any lingering animation so it can't leak into future updates.
     * A follow node can share its currentAnimation with a surviving lead
     * (via resumingFrom), in which case it isn't ours to stop.
     */
    const stack = node.getStack()
    if (!stack || node.isLead()) node.currentAnimation?.stop()

    node.unmount()
    layoutNodes.delete(element)
}

function flushPendingBuilders() {
    const builders = pendingBuilders!
    pendingBuilders = undefined

    flushPendingFrame()

    /**
     * Discover and mount every node across all builders before snapshotting
     * any of them. Mounting during an active update flags isLayoutDirty,
     * which would make that node's own willUpdate skip its snapshot.
     * Document order guarantees ancestors mount before descendants, even
     * when they're discovered by different builders.
     */
    const targets = new Map<HTMLElement, LayoutAnimationBuilder[]>()
    for (const builder of builders) {
        for (const element of builder.collectTargets()) {
            const owners = targets.get(element)
            owners ? owners.push(builder) : targets.set(element, [builder])
        }
    }

    const union = new Map<HTMLElement, IProjectionNode>()
    for (const element of sortDocumentOrder(targets.keys())) {
        const owners = targets.get(element)!
        const node = prepareNode(
            element,
            owners[owners.length - 1].transitionFor(element)
        )
        for (const owner of owners) owner.adopt(element, node)
        union.set(element, node)
    }

    union.forEach((node) => {
        node.isLayoutDirty = false
        node.willUpdate()
    })

    const updatePromises: Promise<void>[] = []
    for (const builder of builders) {
        const result = builder.runUpdate()
        if (result) updatePromises.push(result)
    }

    const commit = () => {
        /**
         * Process all additions before any removals so that, even across
         * builders, a removed member knows whether a replacement with the
         * same layoutId was added in this commit.
         */
        const newMemberIds = new Set<string>()
        for (const builder of builders) {
            builder.reconcileAdditions(newMemberIds)
        }
        for (const builder of builders) {
            builder.reconcileRemovals(newMemberIds)
        }

        let root: IProjectionNode | undefined
        union.forEach((node) => (root ||= node.root))
        for (const builder of builders) root ||= builder.getRoot()

        root?.didUpdate()

        /**
         * The root flushes the update on a microtask, synchronously
         * processing the frame that creates the layout animations. Collect
         * them in a later microtask step of the same pass.
         */
        microtask.render(() => {
            for (const builder of builders) builder.finalize()
        })
    }

    updatePromises.length ? Promise.all(updatePromises).then(commit) : commit()
}

export class LayoutAnimationBuilder {
    private sharedTransitions = new Map<string, AnimationOptions>()

    private notifyReady: LayoutBuilderResolve = () => {}
    private rejectReady: LayoutBuilderReject = () => {}
    private readyPromise: Promise<GroupAnimation>

    private tracked = new Map<HTMLElement, IProjectionNode>()
    private restorePoints = new Map<HTMLElement, RestorePoint>()
    private updateError: unknown

    constructor(
        private scope: LayoutAnimationScope,
        private updateDom: () => void | Promise<void>,
        private defaultOptions?: AnimationOptions
    ) {
        this.readyPromise = new Promise<GroupAnimation>((resolve, reject) => {
            this.notifyReady = resolve
            this.rejectReady = reject
        })

        if (!pendingBuilders) {
            pendingBuilders = []
            queueMicrotask(flushPendingBuilders)
        }
        pendingBuilders.push(this)
    }

    shared(id: string, transition: AnimationOptions): this {
        this.sharedTransitions.set(id, transition)
        return this
    }

    then(resolve: LayoutBuilderResolve, reject?: LayoutBuilderReject) {
        return this.readyPromise.then(resolve, reject)
    }

    transitionFor(element: HTMLElement): Transition | undefined {
        const layoutId = element.getAttribute("data-layout-id")
        return ((layoutId && this.sharedTransitions.get(layoutId)) ||
            this.defaultOptions) as Transition | undefined
    }

    adopt(element: HTMLElement, node: IProjectionNode) {
        this.tracked.set(element, node)
        this.restorePoints.set(element, {
            parent: element.parentElement!,
            next: element.nextSibling,
        })
    }

    collectTargets() {
        return collectLayoutElements(this.scope)
    }

    runUpdate(): Promise<void> | undefined {
        try {
            const result = this.updateDom()
            if (result && typeof result.then === "function") {
                return result.then(undefined, (error: unknown) => {
                    this.updateError = error
                })
            }
        } catch (error) {
            this.updateError = error
        }
        return undefined
    }

    reconcileAdditions(newMemberIds: Set<string>) {
        for (const element of collectLayoutElements(this.scope)) {
            if (this.tracked.has(element)) continue
            const node = prepareNode(element, this.transitionFor(element))
            this.adopt(element, node)
            node.options.layoutId && newMemberIds.add(node.options.layoutId)
        }
    }

    reconcileRemovals(newMemberIds: Set<string>) {
        this.tracked.forEach((node, element) => {
            if (element.isConnected) return

            const { layoutId } = node.options
            const stack = node.getStack()
            const hasSurvivor =
                stack &&
                stack.members.some(
                    (member) =>
                        member !== node &&
                        (member.instance as HTMLElement | undefined)
                            ?.isConnected
                )

            /**
             * A removed lead with a surviving stack member - and no
             * replacement member added this commit - runs an exit
             * crossfade: restore the element to its old position in the
             * DOM, relegate it and let the survivor take over. It's
             * removed again once the animation completes.
             */
            if (
                layoutId &&
                node.isLead() &&
                hasSurvivor &&
                !newMemberIds.has(layoutId)
            ) {
                const restore = this.restorePoints.get(element)
                if (restore && restore.parent.isConnected) {
                    restore.parent.insertBefore(
                        element,
                        restore.next && restore.next.parentNode === restore.parent
                            ? restore.next
                            : null
                    )
                    node.isPresent = false
                    node.setOptions({
                        onExitComplete: () => {
                            element.remove()
                            dropNode(element, node)
                        },
                    })
                    if (node.relegate()) return

                    element.remove()
                }
            }

            dropNode(element, node)
            this.tracked.delete(element)
        })
    }

    getRoot(): IProjectionNode | undefined {
        let root: IProjectionNode | undefined
        this.tracked.forEach((node) => (root ||= node.root))
        return root
    }

    finalize() {
        if (this.updateError) {
            this.rejectReady(this.updateError)
            return
        }

        const animations = new Set<GroupAnimation["animations"][number]>()
        this.tracked.forEach((node) => {
            if (node.instance && node.currentAnimation) {
                animations.add(node.currentAnimation)
            }
        })

        this.notifyReady(new GroupAnimation([...animations]))
    }
}

export function parseAnimateLayoutArgs(
    scopeOrUpdateDom: ElementOrSelector | (() => void),
    updateDomOrOptions?: (() => void) | AnimationOptions,
    options?: AnimationOptions
): {
    scope: Element | Document
    updateDom: () => void
    defaultOptions?: AnimationOptions
} {
    if (typeof scopeOrUpdateDom === "function") {
        return {
            scope: document,
            updateDom: scopeOrUpdateDom,
            defaultOptions: updateDomOrOptions as AnimationOptions | undefined,
        }
    }

    const scope =
        scopeOrUpdateDom instanceof Document
            ? scopeOrUpdateDom
            : resolveElements(scopeOrUpdateDom)[0] ?? document

    return {
        scope,
        updateDom: updateDomOrOptions as () => void,
        defaultOptions: options,
    }
}
