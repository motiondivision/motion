import { clamp } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import type { AnimationOptions, Transition } from "../animation/types"
import { frame, frameData, frameSteps } from "../frameloop"
import { time } from "../frameloop/sync-time"
import {
    HTMLProjectionNode,
    rootProjectionNode,
} from "../projection/node/HTMLProjectionNode"
import type { IProjectionNode, ProjectionNodeOptions } from "../projection/node/types"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { visualElementStore } from "../render/store"
import type { VisualElement } from "../render/VisualElement"
import {
    resolveElements,
    type ElementOrSelector,
} from "../utils/resolve-elements"

type LayoutAnimationScope = Element | Document
type LayoutBuilderResolve = (animation: GroupAnimation) => void
type LayoutBuilderReject = (error: unknown) => void

/**
 * `animateLayout()` drives the *same* projection (FLIP) engine that React's
 * layout animations use (`HTMLProjectionNode`), but imperatively over plain DOM.
 *
 * The engine is built around a single shared projection tree: every node attaches
 * (directly or via an ancestor) to one auto-created root (`rootProjectionNode`),
 * and that root coordinates every measure/animate pass. We lean on that here:
 *
 * - Projection nodes are persisted on the existing `visualElementStore` (keyed by
 *   DOM element), so they are *reused* across every `animateLayout` call rather
 *   than rebuilt per call. A node's projection parent is the nearest ancestor
 *   element that already has a node, so the tree mirrors the DOM.
 * - Because all nodes share one root, calls that fire against different (or
 *   intersecting) parts of the tree compose automatically: each call's
 *   `willUpdate()` snapshots feed into a single, microtask-deduped
 *   `root.didUpdate()` measure pass — exactly how independent React renders in
 *   different parts of the tree collapse into one commit.
 *
 * Elements opt in via attributes:
 * - `data-layout` / `data-layout="position|size|preserve-aspect|x|y"` — animate
 *   this element's own layout (the value picks the animation type).
 * - `data-layout-id="<id>"` — a *shared* element. Elements that share an id are
 *   matched across the mutation by the engine's `NodeStack` (promote / relegate /
 *   crossfade), so one morphs into the other.
 */
const LAYOUT_SELECTOR = "[data-layout],[data-layout-id]"

interface ExitingElement {
    element: Element
    node: IProjectionNode
}

interface ElementRecord {
    element: Element
    parent: Node | null
    next: Node | null
}

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const noop = () => {}

/**
 * Synchronously flush any pending projection work (the same update→preRender→
 * render flush the engine runs after measuring). Crucially this materialises a
 * paused animation that was seeked but not yet rendered — e.g. interrupting a
 * `controls.time = x`'d transition with a new `animateLayout()` — so the next
 * call snapshots the element's true current visual state rather than a stale one.
 */
function flushPendingFrame() {
    const now = time.now()
    frameData.delta = clamp(0, 1000 / 60, now - frameData.timestamp)
    frameData.timestamp = now
    frameData.isProcessing = true
    frameSteps.update.process(frameData)
    frameSteps.preRender.process(frameData)
    frameSteps.render.process(frameData)
    frameData.isProcessing = false
}

/**
 * All layout elements within `scope`, plus `scope` itself if it is a matching
 * element (so a passed-in element can animate its own layout, not just children).
 * Returned in document order — ancestors before descendants — which lets us wire
 * each node's projection parent to an already-created ancestor node.
 */
function collectLayoutElements(scope: LayoutAnimationScope): Element[] {
    const elements = Array.from(scope.querySelectorAll(LAYOUT_SELECTOR))

    if (scope instanceof Element && scope.matches(LAYOUT_SELECTOR)) {
        elements.unshift(scope)
    }

    return elements
}

function readLayoutAttributes(element: Element): {
    layout?: boolean | string
    layoutId?: string
    animationType?: ProjectionNodeOptions["animationType"]
} {
    const rawLayout = element.getAttribute("data-layout")
    const layoutId = element.getAttribute("data-layout-id") || undefined

    let layout: boolean | string | undefined
    let animationType: ProjectionNodeOptions["animationType"]

    if (rawLayout !== null) {
        if (rawLayout === "" || rawLayout === "true") {
            layout = true
            animationType = "both"
        } else {
            layout = rawLayout
            animationType = rawLayout as ProjectionNodeOptions["animationType"]
        }
    } else if (layoutId) {
        /**
         * A shared element with no explicit `data-layout` animates both its size
         * and position by default.
         */
        layout = true
        animationType = "both"
    }

    return { layout, layoutId, animationType }
}

/**
 * The nearest ancestor element that already has a projection node, or `undefined`
 * (in which case the new node attaches to the shared root).
 */
function getProjectionParent(element: Element): IProjectionNode | undefined {
    let ancestor = element.parentElement

    while (ancestor) {
        const projection = visualElementStore.get(ancestor)?.projection
        if (projection) return projection
        ancestor = ancestor.parentElement
    }

    return undefined
}

function getOrCreateVisualElement(element: Element): VisualElement {
    let visualElement = visualElementStore.get(element)

    if (!visualElement) {
        visualElement = new HTMLVisualElement(
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
            } as any,
            { allowProjection: true }
        )
    }

    return visualElement
}

export class LayoutAnimationBuilder {
    private sharedTransitions: { [id: string]: AnimationOptions } = {}
    private notifyReady!: LayoutBuilderResolve
    private rejectReady!: LayoutBuilderReject
    private readyPromise: Promise<GroupAnimation>
    private hasStarted = false

    constructor(
        private scope: LayoutAnimationScope,
        private updateDom: () => void | Promise<void>,
        private defaultOptions?: AnimationOptions
    ) {
        this.readyPromise = new Promise<GroupAnimation>((resolve, reject) => {
            this.notifyReady = resolve
            this.rejectReady = reject
        })
    }

    /**
     * Override the transition for elements with a given `data-layout-id`. The
     * default options apply to every other element.
     */
    shared(id: string, transition: AnimationOptions): this {
        this.sharedTransitions[id] = transition
        return this
    }

    then(
        resolve: LayoutBuilderResolve,
        reject?: LayoutBuilderReject
    ): Promise<void> {
        if (!this.hasStarted) {
            this.hasStarted = true
            this.run().then(this.notifyReady, this.rejectReady)
        }

        return this.readyPromise.then(resolve, reject)
    }

    private async run(): Promise<GroupAnimation> {
        const touched = new Set<IProjectionNode>()
        const exiting: ExitingElement[] = []

        // Materialise any pending paused/seeked projection state so snapshots
        // below reflect the element's true current visual position.
        flushPendingFrame()

        /**
         * 1. Snapshot the layout of every existing element before mutating, and
         *    remember where each lives so removed elements can be re-inserted for
         *    an exit animation.
         */
        const records: ElementRecord[] = collectLayoutElements(this.scope).map(
            (element) => ({
                element,
                parent: element.parentNode,
                next: element.nextSibling,
            })
        )

        /**
         * Mount every node BEFORE snapshotting any of them. A node that mounts
         * after the update has already begun (root.hasTreeAnimated) is flagged
         * layout-dirty, which would make its own willUpdate() skip the snapshot —
         * so all nodes must exist before the first willUpdate, mirroring React's
         * commit where every node is present before snapshots are taken.
         */
        const beforeNodes = records.map(({ element }) => this.ensureNode(element))
        for (const node of beforeNodes) {
            touched.add(node)
            node.isLayoutDirty = false
            node.willUpdate()
        }

        /**
         * 2. Mutate the DOM. We only `await` an async `updateDom`; a synchronous
         *    one is left synchronous so concurrent `animateLayout` calls all reach
         *    `root.didUpdate()` in the same tick and share one measure pass.
         */
        const domResult = this.updateDom()
        if (
            domResult &&
            typeof (domResult as Promise<void>).then === "function"
        ) {
            await domResult
        }

        this.reconcile(records, touched, exiting)

        /**
         * 3. Wait one frame for the coordinated measure pass and the deferred
         *    animation start, then collect the animations this call produced.
         */
        await nextFrame()

        const animation = new GroupAnimation(
            Array.from(touched, (node) => node.currentAnimation)
        )

        /**
         * 4. Once the animation completes, drop the elements we kept alive purely
         *    to crossfade out.
         */
        if (exiting.length) {
            animation.finished.then(() => {
                for (const { element, node } of exiting) {
                    node.unmount()
                    element.parentNode?.removeChild(element)
                    visualElementStore.delete(element)
                }
            }, noop)
        }

        return animation
    }

    /**
     * After the DOM mutation: mount nodes for newly-added elements (promoting
     * shared leads), handle elements that were removed, then kick off the shared
     * root's measure + animate.
     */
    private reconcile(
        records: ElementRecord[],
        touched: Set<IProjectionNode>,
        exiting: ExitingElement[]
    ) {
        // a. Mount/refresh nodes for everything now present (in document order so
        //    new ancestors are mounted before their children).
        for (const element of collectLayoutElements(this.scope)) {
            touched.add(this.ensureNode(element))
        }

        // b. Handle elements removed during the mutation.
        for (const { element, parent, next } of records) {
            if (element.isConnected) continue

            const node = visualElementStore.get(element)?.projection
            if (!node) continue

            const canReinsert =
                node.options.layoutId && parent && (parent as Node).isConnected

            if (canReinsert) {
                /**
                 * Re-insert the removed shared element where it was so it can
                 * crossfade out, then relegate lead back to a still-present
                 * sibling. If nothing takes over (it's being replaced by a new
                 * element), there's no crossfade pair, so just drop it.
                 */
                const reference =
                    next && next.parentNode === parent ? next : null
                ;(parent as Node).insertBefore(element, reference)
                node.isPresent = false

                if (node.relegate()) {
                    exiting.push({ element, node })
                    touched.add(node)
                } else {
                    ;(parent as Node).removeChild(element)
                    this.dropNode(element, node, touched)
                }
            } else {
                // No shared twin (or its container is gone): unmount, which lets
                // the stack promote any remaining member to fill the gap.
                this.dropNode(element, node, touched)
            }
        }

        // c. Trigger the single coordinated measure + animate on the shared root.
        rootProjectionNode.current?.didUpdate()
    }

    /**
     * Fully retire a node whose element left the DOM with no exit animation.
     * Stopping any in-flight animation matters when interrupting: a node that
     * was mid-animation (e.g. a paused shared transition) must not linger and
     * leak its stale state into the animations this call collects.
     */
    private dropNode(
        element: Element,
        node: IProjectionNode,
        touched: Set<IProjectionNode>
    ) {
        node.currentAnimation?.stop()
        node.unmount()
        touched.delete(node)
        visualElementStore.delete(element)
    }

    /**
     * Reuse the persisted projection node for `element`, or create one and attach
     * it to the shared tree under its nearest ancestor node.
     */
    private ensureNode(element: Element): IProjectionNode {
        const { layout, layoutId, animationType } =
            readLayoutAttributes(element)
        const transition =
            (layoutId && this.sharedTransitions[layoutId]) || this.defaultOptions

        const visualElement = getOrCreateVisualElement(element)

        const options: ProjectionNodeOptions = {
            layout,
            layoutId,
            animationType,
            visualElement,
            crossfade: true,
            transition: transition as Transition,
        }

        if (visualElement.projection) {
            // Reused across calls — refresh per-call options (e.g. transition).
            visualElement.projection.setOptions(options)
        } else {
            /**
             * A first-time node may carry a stale inline transform — most often
             * because `updateDom` cloned an element that was mid-projection (e.g.
             * cloning a card into a modal). The projection owns this element's
             * transform, so clear it before the first measure or it inflates the
             * measured layout.
             */
            if (element instanceof HTMLElement) element.style.transform = ""

            visualElement.projection = new HTMLProjectionNode(
                visualElement.latestValues,
                getProjectionParent(element)
            )
            // setOptions must precede mount so the layout-animation handler is
            // registered.
            visualElement.projection.setOptions(options)

            if (visualElement.current) {
                visualElement.projection.mount(visualElement.current)
            } else {
                visualElement.mount(element as HTMLElement)
            }
        }

        return visualElement.projection
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

    return {
        scope: resolveElements(scopeOrUpdateDom)[0] || document,
        updateDom: updateDomOrOptions as () => void,
        defaultOptions: options,
    }
}
