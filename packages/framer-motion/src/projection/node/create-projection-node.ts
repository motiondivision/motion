import { frame, cancelFrame } from "../../frameloop"
import { AnimationPlaybackControls } from "../../animation/types"
import { ResolvedValues } from "../../render/types"
import { SubscriptionManager } from "../../utils/subscription-manager"
import { mixValues } from "../animation/mix-values"
import { copyAxisDeltaInto, copyBoxInto } from "../geometry/copy"
import { applyBoxDelta, applyTreeDeltas } from "../geometry/delta-apply"
import {
    calcBoxDelta,
    calcLength,
    calcRelativeBox,
    calcRelativePosition,
    isNear,
} from "../geometry/delta-calc"
import { removeBoxTransforms } from "../geometry/delta-remove"
import { Axis, AxisDelta, Box, Delta } from "../geometry/types"
import { transformBox, translateAxis } from "../geometry/delta-apply"
import { Point } from "../geometry/types"
import { getValueTransition } from "../../animation/utils/get-value-transition"
import {
    aspectRatio,
    axisDeltaEquals,
    boxEquals,
    boxEqualsRounded,
    isDeltaZero,
} from "../geometry/utils"
import { NodeStack } from "../shared/stack"
import { scaleCorrectors } from "../styles/scale-correction"
import { buildProjectionTransform } from "../styles/transform"
import { eachAxis } from "../utils/each-axis"
import { has2DTranslate, hasScale, hasTransform } from "../utils/has-transform"
import {
    IProjectionNode,
    LayoutEvents,
    LayoutUpdateData,
    ProjectionNodeConfig,
    ProjectionNodeOptions,
    Measurements,
    ScrollMeasurements,
    Phase,
} from "./types"
import { FlatTree } from "../../render/utils/flat-tree"
import { Transition } from "../../types"
import { resolveMotionValue } from "../../value/utils/resolve-motion-value"
import { MotionStyle } from "../../motion/types"
import { globalProjectionState } from "./state"
import { delay } from "../../utils/delay"
import { mixNumber } from "../../utils/mix/number"
import { Process } from "../../frameloop/types"
import { ValueAnimationOptions } from "../../animation/types"
import { frameData } from "../../dom"
import { isSVGElement } from "../../render/dom/utils/is-svg-element"
import { animateSingleValue } from "../../animation/animate/single-value"
import { clamp } from "../../utils/clamp"
import { frameSteps } from "../../frameloop/frame"
import { noop } from "motion-utils"
import { time } from "../../frameloop/sync-time"
import { microtask } from "../../frameloop/microtask"
import { VisualElement } from "../../render/VisualElement"
import { getOptimisedAppearId } from "../../animation/optimized-appear/get-appear-id"
import { createBox, createDelta } from "../geometry/models"

const metrics = {
    type: "projectionFrame",
    totalNodes: 0,
    resolvedTargetDeltas: 0,
    recalculatedProjection: 0,
}

declare global {
    interface Window {
        MotionDebug?: {
            record: (data: typeof metrics) => void
        }
    }
}

const isDebug =
    typeof window !== "undefined" && window.MotionDebug !== undefined

const transformAxes = ["", "X", "Y", "Z"]

const hiddenVisibility: ResolvedValues = { visibility: "hidden" }

/**
 * We use 1000 as the animation target as 0-1000 maps better to pixels than 0-1
 * which has a noticeable difference in spring animations
 */
const animationTarget = 1000

let id = 0

function resetDistortingTransform(
    key: string,
    visualElement: VisualElement,
    values: ResolvedValues,
    sharedAnimationValues?: ResolvedValues
) {
    const { latestValues } = visualElement

    // Record the distorting transform and then temporarily set it to 0
    if (latestValues[key]) {
        values[key] = latestValues[key]
        visualElement.setStaticValue(key, 0)
        if (sharedAnimationValues) {
            sharedAnimationValues[key] = 0
        }
    }
}

function cancelTreeOptimisedTransformAnimations(
    projectionNode: IProjectionNode
) {
    projectionNode.hasCheckedOptimisedAppear = true
    if (projectionNode.root === projectionNode) return

    const { visualElement } = projectionNode.options

    if (!visualElement) return

    const appearId = getOptimisedAppearId(visualElement)

    if (window.MotionHasOptimisedAnimation!(appearId, "transform")) {
        const { layout, layoutId } = projectionNode.options
        window.MotionCancelOptimisedAnimation!(
            appearId,
            "transform",
            frame,
            !(layout || layoutId)
        )
    }

    const { parent } = projectionNode
    if (parent && !parent.hasCheckedOptimisedAppear) {
        cancelTreeOptimisedTransformAnimations(parent)
    }
}

export function createProjectionNode<I>({
    attachResizeListener,
    defaultParent,
    measureScroll,
    checkIsScrollRoot,
    resetTransform,
}: ProjectionNodeConfig<I>) {
    return class ProjectionNode implements IProjectionNode<I> {
        /**
         * A unique ID generated for every projection node.
         */
        id: number = id++

        /**
         * An id that represents a unique session instigated by startUpdate.
         */
        animationId: number = 0

        /**
         * A reference to the platform-native node (currently this will be a HTMLElement).
         */
        instance: I

        /**
         * A reference to the root projection node. There'll only ever be one tree and one root.
         */
        root: IProjectionNode

        /**
         * A reference to this node's parent.
         */
        parent?: IProjectionNode

        /**
         * A path from this node to the root node. This provides a fast way to iterate
         * back up the tree.
         */
        path: IProjectionNode[]

        /**
         * A Set containing all this component's children. This is used to iterate
         * through the children.
         *
         * TODO: This could be faster to iterate as a flat array stored on the root node.
         */
        children = new Set<IProjectionNode>()

        /**
         * Options for the node. We use this to configure what kind of layout animations
         * we should perform (if any).
         */
        options: ProjectionNodeOptions = {}

        /**
         * A snapshot of the element's state just before the current update. This is
         * hydrated when this node's `willUpdate` method is called and scrubbed at the
         * end of the tree's `didUpdate` method.
         */
        snapshot: Measurements | undefined

        /**
         * A box defining the element's layout relative to the page. This will have been
         * captured with all parent scrolls and projection transforms unset.
         */
        layout: Measurements | undefined

        /**
         * The layout used to calculate the previous layout animation. We use this to compare
         * layouts between renders and decide whether we need to trigger a new layout animation
         * or just let the current one play out.
         */
        targetLayout?: Box

        /**
         * A mutable data structure we use to apply all parent transforms currently
         * acting on the element's layout. It's from here we can calculate the projectionDelta
         * required to get the element from its layout into its calculated target box.
         */
        layoutCorrected: Box

        /**
         * An ideal projection transform we want to apply to the element. This is calculated,
         * usually when an element's layout has changed, and we want the element to look as though
         * its in its previous layout on the next frame. From there, we animated it down to 0
         * to animate the element to its new layout.
         */
        targetDelta?: Delta

        /**
         * A mutable structure representing the visual bounding box on the page where we want
         * and element to appear. This can be set directly but is currently derived once a frame
         * from apply targetDelta to layout.
         */
        target?: Box

        /**
         * A mutable structure describing a visual bounding box relative to the element's
         * projected parent. If defined, target will be derived from this rather than targetDelta.
         * If not defined, we'll attempt to calculate on the first layout animation frame
         * based on the targets calculated from targetDelta. This will transfer a layout animation
         * from viewport-relative to parent-relative.
         */
        relativeTarget?: Box

        relativeTargetOrigin?: Box
        relativeParent?: IProjectionNode

        /**
         * We use this to detect when its safe to shut down part of a projection tree.
         * We have to keep projecting children for scale correction and relative projection
         * until all their parents stop performing layout animations.
         */
        isTreeAnimating = false

        isAnimationBlocked = false

        /**
         * If true, attempt to resolve relativeTarget.
         */
        attemptToResolveRelativeTarget?: boolean

        /**
         * A mutable structure that represents the target as transformed by the element's
         * latest user-set transforms (ie scale, x)
         */
        targetWithTransforms?: Box

        /**
         * The previous projection delta, which we can compare with the newly calculated
         * projection delta to see if we need to render.
         */
        prevProjectionDelta?: Delta

        /**
         * A calculated transform that will project an element from its layoutCorrected
         * into the target. This will be used by children to calculate their own layoutCorrect boxes.
         */
        projectionDelta?: Delta

        /**
         * A calculated transform that will project an element from its layoutCorrected
         * into the targetWithTransforms.
         */
        projectionDeltaWithTransform?: Delta

        /**
         * If we're tracking the scroll of this element, we store it here.
         */
        scroll?: ScrollMeasurements

        /**
         * Flag to true if we think this layout has been changed. We can't always know this,
         * currently we set it to true every time a component renders, or if it has a layoutDependency
         * if that has changed between renders. Additionally, components can be grouped by LayoutGroup
         * and if one node is dirtied, they all are.
         */
        isLayoutDirty = false

        /**
         * Flag to true if we think the projection calculations for this node needs
         * recalculating as a result of an updated transform or layout animation.
         */
        isProjectionDirty = false

        /**
         * Flag to true if the layout *or* transform has changed. This then gets propagated
         * throughout the projection tree, forcing any element below to recalculate on the next frame.
         */
        isSharedProjectionDirty = false

        /**
         * Flag transform dirty. This gets propagated throughout the whole tree but is only
         * respected by shared nodes.
         */
        isTransformDirty = false

        /**
         * Block layout updates for instant layout transitions throughout the tree.
         */
        updateManuallyBlocked = false

        updateBlockedByResize = false

        /**
         * Set to true between the start of the first `willUpdate` call and the end of the `didUpdate`
         * call.
         */
        isUpdating = false

        /**
         * If this is an SVG element we currently disable projection transforms
         */
        isSVG = false

        /**
         * Flag to true (during promotion) if a node doing an instant layout transition needs to reset
         * its projection styles.
         */
        needsReset = false

        /**
         * Flags whether this node should have its transform reset prior to measuring.
         */
        shouldResetTransform = false

        /**
         * Store whether this node has been checked for optimised appear animations. As
         * effects fire bottom-up, and we want to look up the tree for appear animations,
         * this makes sure we only check each path once, stopping at nodes that
         * have already been checked.
         */
        hasCheckedOptimisedAppear = false

        /**
         * An object representing the calculated contextual/accumulated/tree scale.
         * This will be used to scale calculcated projection transforms, as these are
         * calculated in screen-space but need to be scaled for elements to layoutly
         * make it to their calculated destinations.
         *
         * TODO: Lazy-init
         */
        treeScale: Point = { x: 1, y: 1 }

        /**
         * Is hydrated with a projection node if an element is animating from another.
         */
        resumeFrom?: IProjectionNode

        /**
         * Is hydrated with a projection node if an element is animating from another.
         */
        resumingFrom?: IProjectionNode

        /**
         * A reference to the element's latest animated values. This is a reference shared
         * between the element's VisualElement and the ProjectionNode.
         */
        latestValues: ResolvedValues

        /**
         *
         */
        eventHandlers = new Map<LayoutEvents, SubscriptionManager<any>>()

        nodes?: FlatTree

        depth: number

        /**
         * If transformTemplate generates a different value before/after the
         * update, we need to reset the transform.
         */
        prevTransformTemplateValue: string | undefined

        preserveOpacity?: boolean

        hasTreeAnimated = false

        constructor(
            latestValues: ResolvedValues = {},
            parent: IProjectionNode | undefined = defaultParent?.()
        ) {
            this.latestValues = latestValues
            this.root = parent ? parent.root || parent : this
            this.path = parent ? [...parent.path, parent] : []
            this.parent = parent

            this.depth = parent ? parent.depth + 1 : 0

            for (let i = 0; i < this.path.length; i++) {
                this.path[i].shouldResetTransform = true
            }

            if (this.root === this) this.nodes = new FlatTree()
        }

        addEventListener(name: LayoutEvents, handler: any) {
            if (!this.eventHandlers.has(name)) {
                this.eventHandlers.set(name, new SubscriptionManager())
            }

            return this.eventHandlers.get(name)!.add(handler)
        }

        notifyListeners(name: LayoutEvents, ...args: any) {
            const subscriptionManager = this.eventHandlers.get(name)
            subscriptionManager && subscriptionManager.notify(...args)
        }

        hasListeners(name: LayoutEvents) {
            return this.eventHandlers.has(name)
        }

        /**
         * Lifecycles
         */
        mount(instance: I, isLayoutDirty = this.root.hasTreeAnimated) {
            if (this.instance) return

            this.isSVG = isSVGElement(instance)

            this.instance = instance

            const { layoutId, layout, visualElement } = this.options
            if (visualElement && !visualElement.current) {
                visualElement.mount(instance)
            }

            this.root.nodes!.add(this)
            this.parent && this.parent.children.add(this)

            if (isLayoutDirty && (layout || layoutId)) {
                this.isLayoutDirty = true
            }

            if (attachResizeListener) {
                let cancelDelay: VoidFunction

                const resizeUnblockUpdate = () =>
                    (this.root.updateBlockedByResize = false)

                attachResizeListener(instance, () => {
                    this.root.updateBlockedByResize = true

                    cancelDelay && cancelDelay()
                    cancelDelay = delay(resizeUnblockUpdate, 250)

                    if (globalProjectionState.hasAnimatedSinceResize) {
                        globalProjectionState.hasAnimatedSinceResize = false
                        this.nodes!.forEach(finishAnimation)
                    }
                })
            }

            if (layoutId) {
                this.root.registerSharedNode(layoutId, this)
            }

            // Only register the handler if it requires layout animation
            if (
                this.options.animate !== false &&
                visualElement &&
                (layoutId || layout)
            ) {
                this.addEventListener(
                    "didUpdate",
                    ({
                        delta,
                        hasLayoutChanged,
                        hasRelativeTargetChanged,
                        layout: newLayout,
                    }: LayoutUpdateData) => {
                        if (this.isTreeAnimationBlocked()) {
                            this.target = undefined
                            this.relativeTarget = undefined
                            return
                        }

                        // TODO: Check here if an animation exists
                        const layoutTransition =
                            this.options.transition ||
                            visualElement.getDefaultTransition() ||
                            defaultLayoutTransition

                        const {
                            onLayoutAnimationStart,
                            onLayoutAnimationComplete,
                        } = visualElement.getProps()

                        /**
                         * The target layout of the element might stay the same,
                         * but its position relative to its parent has changed.
                         */
                        const targetChanged =
                            !this.targetLayout ||
                            !boxEqualsRounded(this.targetLayout, newLayout) ||
                            hasRelativeTargetChanged

                        /**
                         * If the layout hasn't seemed to have changed, it might be that the
                         * element is visually in the same place in the document but its position
                         * relative to its parent has indeed changed. So here we check for that.
                         */
                        const hasOnlyRelativeTargetChanged =
                            !hasLayoutChanged && hasRelativeTargetChanged

                        if (
                            this.options.layoutRoot ||
                            (this.resumeFrom && this.resumeFrom.instance) ||
                            hasOnlyRelativeTargetChanged ||
                            (hasLayoutChanged &&
                                (targetChanged || !this.currentAnimation))
                        ) {
                            if (this.resumeFrom) {
                                this.resumingFrom = this.resumeFrom
                                this.resumingFrom.resumingFrom = undefined
                            }

                            this.setAnimationOrigin(
                                delta,
                                hasOnlyRelativeTargetChanged
                            )

                            const animationOptions = {
                                ...getValueTransition(
                                    layoutTransition,
                                    "layout"
                                ),
                                onPlay: onLayoutAnimationStart,
                                onComplete: onLayoutAnimationComplete,
                            }

                            if (
                                visualElement.shouldReduceMotion ||
                                this.options.layoutRoot
                            ) {
                                animationOptions.delay = 0
                                animationOptions.type = false
                            }

                            this.startAnimation(animationOptions)
                        } else {
                            /**
                             * If the layout hasn't changed and we have an animation that hasn't started yet,
                             * finish it immediately. Otherwise it will be animating from a location
                             * that was probably never commited to screen and look like a jumpy box.
                             */

                            if (!hasLayoutChanged) {
                                finishAnimation(this)
                            }

                            if (this.isLead() && this.options.onExitComplete) {
                                this.options.onExitComplete()
                            }
                        }

                        this.targetLayout = newLayout
                    }
                )
            }
        }

        unmount() {
            this.options.layoutId && this.willUpdate()
            this.root.nodes!.remove(this)
            const stack = this.getStack()
            stack && stack.remove(this)
            this.parent && this.parent.children.delete(this)
            ;(this.instance as any) = undefined

            cancelFrame(this.updateProjection)
        }

        // only on the root
        blockUpdate() {
            this.updateManuallyBlocked = true
        }

        unblockUpdate() {
            this.updateManuallyBlocked = false
        }

        isUpdateBlocked() {
            return this.updateManuallyBlocked || this.updateBlockedByResize
        }

        isTreeAnimationBlocked() {
            return (
                this.isAnimationBlocked ||
                (this.parent && this.parent.isTreeAnimationBlocked()) ||
                false
            )
        }

        // Note: currently only running on root node
        startUpdate() {
            console.log("update blocked")
            if (this.isUpdateBlocked()) return

            console.log("start update")
            this.isUpdating = true

            this.nodes && this.nodes.forEach(resetSkewAndRotation)
            this.animationId++
        }

        getTransformTemplate() {
            const { visualElement } = this.options
            return visualElement && visualElement.getProps().transformTemplate
        }

        willUpdate(shouldNotifyListeners = true) {
            this.root.hasTreeAnimated = true

            if (this.root.isUpdateBlocked()) {
                this.options.onExitComplete && this.options.onExitComplete()
                return
            }

            /**
             * If we're running optimised appear animations then these must be
             * cancelled before measuring the DOM. This is so we can measure
             * the true layout of the element rather than the WAAPI animation
             * which will be unaffected by the resetSkewAndRotate step.
             *
             * Note: This is a DOM write. Worst case scenario is this is sandwiched
             * between other snapshot reads which will cause unnecessary style recalculations.
             * This has to happen here though, as we don't yet know which nodes will need
             * snapshots in startUpdate(), but we only want to cancel optimised animations
             * if a layout animation measurement is actually going to be affected by them.
             */
            if (
                window.MotionCancelOptimisedAnimation &&
                !this.hasCheckedOptimisedAppear
            ) {
                cancelTreeOptimisedTransformAnimations(this)
            }

            !this.root.isUpdating && this.root.startUpdate()
            if (this.isLayoutDirty) return

            this.isLayoutDirty = true
            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                node.shouldResetTransform = true

                node.updateScroll("snapshot")

                if (node.options.layoutRoot) {
                    node.willUpdate(false)
                }
            }

            const { layoutId, layout } = this.options
            if (layoutId === undefined && !layout) return

            const transformTemplate = this.getTransformTemplate()
            this.prevTransformTemplateValue = transformTemplate
                ? transformTemplate(this.latestValues, "")
                : undefined

            this.updateSnapshot()
            shouldNotifyListeners && this.notifyListeners("willUpdate")
        }

        // Note: Currently only running on root node
        updateScheduled = false

        update() {
            this.updateScheduled = false

            const updateWasBlocked = this.isUpdateBlocked()

            // When doing an instant transition, we skip the layout update,
            // but should still clean up the measurements so that the next
            // snapshot could be taken correctly.
            if (updateWasBlocked) {
                this.unblockUpdate()
                this.clearAllSnapshots()
                this.nodes!.forEach(clearMeasurements)
                return
            }

            if (!this.isUpdating) {
                this.nodes!.forEach(clearIsLayoutDirty)
            } else {
                this.isUpdating = false

                /**
                 * Write
                 */
                this.nodes!.forEach(resetTransformStyle)

                /**
                 * Read ==================
                 */
                // Update layout measurements of updated children
                this.nodes!.forEach(updateLayout)

                /**
                 * Write
                 */
                // Notify listeners that the layout is updated
                this.nodes!.forEach(notifyLayoutUpdate)
            }

            this.clearAllSnapshots()

            /**
             * Manually flush any pending updates. Ideally
             * we could leave this to the following requestAnimationFrame but this seems
             * to leave a flash of incorrectly styled content.
             */
            const now = time.now()
            frameData.delta = clamp(0, 1000 / 60, now - frameData.timestamp)
            frameData.timestamp = now
            frameData.isProcessing = true
            frameSteps.update.process(frameData)
            frameSteps.preRender.process(frameData)
            frameSteps.render.process(frameData)
            frameData.isProcessing = false
        }

        scheduleUpdate = () => this.update()

        didUpdate() {
            if (!this.updateScheduled) {
                this.updateScheduled = true
                microtask.read(this.scheduleUpdate)
            }
        }

        clearAllSnapshots() {
            this.nodes!.forEach(clearSnapshot)
            this.sharedNodes.forEach(removeLeadSnapshots)
        }

        projectionUpdateScheduled = false
        scheduleUpdateProjection() {
            if (!this.projectionUpdateScheduled) {
                this.projectionUpdateScheduled = true
                frame.preRender(this.updateProjection, false, true)
            }
        }

        scheduleCheckAfterUnmount() {
            /**
             * If the unmounting node is in a layoutGroup and did trigger a willUpdate,
             * we manually call didUpdate to give a chance to the siblings to animate.
             * Otherwise, cleanup all snapshots to prevents future nodes from reusing them.
             */
            frame.postRender(() => {
                if (this.isLayoutDirty) {
                    this.root.didUpdate()
                } else {
                    this.root.checkUpdateFailed()
                }
            })
        }

        checkUpdateFailed = () => {
            if (this.isUpdating) {
                this.isUpdating = false
                this.clearAllSnapshots()
            }
        }

        /**
         * This is a multi-step process as shared nodes might be of different depths. Nodes
         * are sorted by depth order, so we need to resolve the entire tree before moving to
         * the next step.
         */
        updateProjection = () => {
            this.projectionUpdateScheduled = false

            /**
             * Reset debug counts. Manually resetting rather than creating a new
             * object each frame.
             */
            if (isDebug) {
                metrics.totalNodes =
                    metrics.resolvedTargetDeltas =
                    metrics.recalculatedProjection =
                        0
            }

            this.nodes!.forEach(propagateDirtyNodes)
            this.nodes!.forEach(resolveTargetDelta)
            this.nodes!.forEach(calcProjection)
            this.nodes!.forEach(cleanDirtyNodes)

            if (isDebug) {
                window.MotionDebug!.record(metrics)
            }
        }

        /**
         * Update measurements
         */
        updateSnapshot() {
            if (this.snapshot || !this.instance) return

            this.snapshot = this.measure()
        }

        updateLayout() {
            if (!this.instance) return

            this.updateScroll()

            if (
                !(this.options.alwaysMeasureLayout && this.isLead()) &&
                !this.isLayoutDirty
            ) {
                return
            }

            /**
             * When a node is mounted, it simply resumes from the prevLead's
             * snapshot instead of taking a new one, but the ancestors scroll
             * might have updated while the prevLead is unmounted. We need to
             * update the scroll again to make sure the layout we measure is
             * up to date.
             */
            if (this.resumeFrom && !this.resumeFrom.instance) {
                for (let i = 0; i < this.path.length; i++) {
                    const node = this.path[i]
                    node.updateScroll()
                }
            }

            const prevLayout = this.layout
            this.layout = this.measure(false)
            this.layoutCorrected = createBox()
            this.isLayoutDirty = false
            this.projectionDelta = undefined
            this.notifyListeners("measure", this.layout.layoutBox)

            const { visualElement } = this.options
            visualElement &&
                visualElement.notify(
                    "LayoutMeasure",
                    this.layout.layoutBox,
                    prevLayout ? prevLayout.layoutBox : undefined
                )
        }

        updateScroll(phase: Phase = "measure") {
            let needsMeasurement = Boolean(
                this.options.layoutScroll && this.instance
            )

            if (
                this.scroll &&
                this.scroll.animationId === this.root.animationId &&
                this.scroll.phase === phase
            ) {
                needsMeasurement = false
            }

            if (needsMeasurement) {
                const isRoot = checkIsScrollRoot(this.instance)
                this.scroll = {
                    animationId: this.root.animationId,
                    phase,
                    isRoot,
                    offset: measureScroll(this.instance),
                    wasRoot: this.scroll ? this.scroll.isRoot : isRoot,
                }
            }
        }

        resetTransform() {
            if (!resetTransform) return

            const isResetRequested =
                this.isLayoutDirty ||
                this.shouldResetTransform ||
                this.options.alwaysMeasureLayout

            const hasProjection =
                this.projectionDelta && !isDeltaZero(this.projectionDelta)

            const transformTemplate = this.getTransformTemplate()
            const transformTemplateValue = transformTemplate
                ? transformTemplate(this.latestValues, "")
                : undefined

            const transformTemplateHasChanged =
                transformTemplateValue !== this.prevTransformTemplateValue

            if (
                isResetRequested &&
                (hasProjection ||
                    hasTransform(this.latestValues) ||
                    transformTemplateHasChanged)
            ) {
                resetTransform(this.instance, transformTemplateValue)
                this.shouldResetTransform = false
                this.scheduleRender()
            }
        }

        measure(removeTransform = true) {
            const pageBox = this.measurePageBox()

            let layoutBox = this.removeElementScroll(pageBox)

            /**
             * Measurements taken during the pre-render stage
             * still have transforms applied so we remove them
             * via calculation.
             */
            if (removeTransform) {
                layoutBox = this.removeTransform(layoutBox)
            }

            roundBox(layoutBox)

            return {
                animationId: this.root.animationId,
                measuredBox: pageBox,
                layoutBox,
                latestValues: {},
                source: this.id,
            }
        }

        measurePageBox() {
            const { visualElement } = this.options
            if (!visualElement) return createBox()

            const box = visualElement.measureViewportBox()

            const wasInScrollRoot =
                this.scroll?.wasRoot || this.path.some(checkNodeWasScrollRoot)

            if (!wasInScrollRoot) {
                // Remove viewport scroll to give page-relative coordinates
                const { scroll } = this.root
                if (scroll) {
                    translateAxis(box.x, scroll.offset.x)
                    translateAxis(box.y, scroll.offset.y)
                }
            }

            return box
        }

        removeElementScroll(box: Box): Box {
            const boxWithoutScroll = createBox()
            copyBoxInto(boxWithoutScroll, box)

            if (this.scroll?.wasRoot) {
                return boxWithoutScroll
            }

            /**
             * Performance TODO: Keep a cumulative scroll offset down the tree
             * rather than loop back up the path.
             */
            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                const { scroll, options } = node

                if (node !== this.root && scroll && options.layoutScroll) {
                    /**
                     * If this is a new scroll root, we want to remove all previous scrolls
                     * from the viewport box.
                     */
                    if (scroll.wasRoot) {
                        copyBoxInto(boxWithoutScroll, box)
                    }

                    translateAxis(boxWithoutScroll.x, scroll.offset.x)
                    translateAxis(boxWithoutScroll.y, scroll.offset.y)
                }
            }

            return boxWithoutScroll
        }

        applyTransform(box: Box, transformOnly = false): Box {
            const withTransforms = createBox()
            copyBoxInto(withTransforms, box)
            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]

                if (
                    !transformOnly &&
                    node.options.layoutScroll &&
                    node.scroll &&
                    node !== node.root
                ) {
                    transformBox(withTransforms, {
                        x: -node.scroll.offset.x,
                        y: -node.scroll.offset.y,
                    })
                }

                if (!hasTransform(node.latestValues)) continue
                transformBox(withTransforms, node.latestValues)
            }

            if (hasTransform(this.latestValues)) {
                transformBox(withTransforms, this.latestValues)
            }

            return withTransforms
        }

        removeTransform(box: Box): Box {
            const boxWithoutTransform = createBox()
            copyBoxInto(boxWithoutTransform, box)

            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                if (!node.instance) continue
                if (!hasTransform(node.latestValues)) continue

                hasScale(node.latestValues) && node.updateSnapshot()

                const sourceBox = createBox()
                const nodeBox = node.measurePageBox()
                copyBoxInto(sourceBox, nodeBox)

                removeBoxTransforms(
                    boxWithoutTransform,
                    node.latestValues,
                    node.snapshot ? node.snapshot.layoutBox : undefined,
                    sourceBox
                )
            }

            if (hasTransform(this.latestValues)) {
                removeBoxTransforms(boxWithoutTransform, this.latestValues)
            }

            return boxWithoutTransform
        }

        setTargetDelta(delta: Delta) {
            this.targetDelta = delta
            this.root.scheduleUpdateProjection()
            this.isProjectionDirty = true
        }

        setOptions(options: ProjectionNodeOptions) {
            this.options = {
                ...this.options,
                ...options,
                crossfade:
                    options.crossfade !== undefined ? options.crossfade : true,
            }
        }

        clearMeasurements() {
            this.scroll = undefined
            this.layout = undefined
            this.snapshot = undefined
            this.prevTransformTemplateValue = undefined
            this.targetDelta = undefined
            this.target = undefined
            this.isLayoutDirty = false
        }

        forceRelativeParentToResolveTarget() {
            if (!this.relativeParent) return

            /**
             * If the parent target isn't up-to-date, force it to update.
             * This is an unfortunate de-optimisation as it means any updating relative
             * projection will cause all the relative parents to recalculate back
             * up the tree.
             */
            if (
                this.relativeParent.resolvedRelativeTargetAt !==
                frameData.timestamp
            ) {
                this.relativeParent.resolveTargetDelta(true)
            }
        }

        /**
         * Frame calculations
         */
        resolvedRelativeTargetAt: number = 0.0
        resolveTargetDelta(forceRecalculation = false) {
            /**
             * Once the dirty status of nodes has been spread through the tree, we also
             * need to check if we have a shared node of a different depth that has itself
             * been dirtied.
             */
            const lead = this.getLead()
            this.isProjectionDirty ||= lead.isProjectionDirty
            this.isTransformDirty ||= lead.isTransformDirty
            this.isSharedProjectionDirty ||= lead.isSharedProjectionDirty

            const isShared = Boolean(this.resumingFrom) || this !== lead

            /**
             * We don't use transform for this step of processing so we don't
             * need to check whether any nodes have changed transform.
             */
            const canSkip = !(
                forceRecalculation ||
                (isShared && this.isSharedProjectionDirty) ||
                this.isProjectionDirty ||
                this.parent?.isProjectionDirty ||
                this.attemptToResolveRelativeTarget ||
                this.root.updateBlockedByResize
            )

            if (canSkip) return

            const { layout, layoutId } = this.options

            /**
             * If we have no layout, we can't perform projection, so early return
             */
            if (!this.layout || !(layout || layoutId)) return

            this.resolvedRelativeTargetAt = frameData.timestamp

            /**
             * If we don't have a targetDelta but do have a layout, we can attempt to resolve
             * a relativeParent. This will allow a component to perform scale correction
             * even if no animation has started.
             */
            if (!this.targetDelta && !this.relativeTarget) {
                const relativeParent = this.getClosestProjectingParent()
                if (
                    relativeParent &&
                    relativeParent.layout &&
                    this.animationProgress !== 1
                ) {
                    this.relativeParent = relativeParent
                    this.forceRelativeParentToResolveTarget()
                    this.relativeTarget = createBox()
                    this.relativeTargetOrigin = createBox()
                    calcRelativePosition(
                        this.relativeTargetOrigin,
                        this.layout.layoutBox,
                        relativeParent.layout.layoutBox
                    )

                    copyBoxInto(this.relativeTarget, this.relativeTargetOrigin)
                } else {
                    this.relativeParent = this.relativeTarget = undefined
                }
            }

            /**
             * If we have no relative target or no target delta our target isn't valid
             * for this frame.
             */
            if (!this.relativeTarget && !this.targetDelta) return

            /**
             * Lazy-init target data structure
             */
            if (!this.target) {
                this.target = createBox()
                this.targetWithTransforms = createBox()
            }

            /**
             * If we've got a relative box for this component, resolve it into a target relative to the parent.
             */
            if (
                this.relativeTarget &&
                this.relativeTargetOrigin &&
                this.relativeParent &&
                this.relativeParent.target
            ) {
                this.forceRelativeParentToResolveTarget()

                calcRelativeBox(
                    this.target,
                    this.relativeTarget,
                    this.relativeParent.target
                )

                /**
                 * If we've only got a targetDelta, resolve it into a target
                 */
            } else if (this.targetDelta) {
                if (Boolean(this.resumingFrom)) {
                    // TODO: This is creating a new object every frame
                    this.target = this.applyTransform(this.layout.layoutBox)
                } else {
                    copyBoxInto(this.target, this.layout.layoutBox)
                }

                applyBoxDelta(this.target, this.targetDelta)
            } else {
                /**
                 * If no target, use own layout as target
                 */
                copyBoxInto(this.target, this.layout.layoutBox)
            }

            /**
             * If we've been told to attempt to resolve a relative target, do so.
             */
            if (this.attemptToResolveRelativeTarget) {
                this.attemptToResolveRelativeTarget = false
                const relativeParent = this.getClosestProjectingParent()

                if (
                    relativeParent &&
                    Boolean(relativeParent.resumingFrom) ===
                        Boolean(this.resumingFrom) &&
                    !relativeParent.options.layoutScroll &&
                    relativeParent.target &&
                    this.animationProgress !== 1
                ) {
                    this.relativeParent = relativeParent
                    this.forceRelativeParentToResolveTarget()
                    this.relativeTarget = createBox()
                    this.relativeTargetOrigin = createBox()

                    calcRelativePosition(
                        this.relativeTargetOrigin,
                        this.target,
                        relativeParent.target
                    )

                    copyBoxInto(this.relativeTarget, this.relativeTargetOrigin)
                } else {
                    this.relativeParent = this.relativeTarget = undefined
                }
            }

            /**
             * Increase debug counter for resolved target deltas
             */
            if (isDebug) {
                metrics.resolvedTargetDeltas++
            }
        }

        getClosestProjectingParent() {
            if (
                !this.parent ||
                hasScale(this.parent.latestValues) ||
                has2DTranslate(this.parent.latestValues)
            ) {
                return undefined
            }

            if (this.parent.isProjecting()) {
                return this.parent
            } else {
                return this.parent.getClosestProjectingParent()
            }
        }

        isProjecting() {
            return Boolean(
                (this.relativeTarget ||
                    this.targetDelta ||
                    this.options.layoutRoot) &&
                    this.layout
            )
        }

        hasProjected: boolean = false

        calcProjection() {
            const lead = this.getLead()
            const isShared = Boolean(this.resumingFrom) || this !== lead

            let canSkip = true

            /**
             * If this is a normal layout animation and neither this node nor its nearest projecting
             * is dirty then we can't skip.
             */
            if (this.isProjectionDirty || this.parent?.isProjectionDirty) {
                canSkip = false
            }

            /**
             * If this is a shared layout animation and this node's shared projection is dirty then
             * we can't skip.
             */
            if (
                isShared &&
                (this.isSharedProjectionDirty || this.isTransformDirty)
            ) {
                canSkip = false
            }

            /**
             * If we have resolved the target this frame we must recalculate the
             * projection to ensure it visually represents the internal calculations.
             */
            if (this.resolvedRelativeTargetAt === frameData.timestamp) {
                canSkip = false
            }

            if (canSkip) return

            const { layout, layoutId } = this.options

            /**
             * If this section of the tree isn't animating we can
             * delete our target sources for the following frame.
             */
            this.isTreeAnimating = Boolean(
                (this.parent && this.parent.isTreeAnimating) ||
                    this.currentAnimation ||
                    this.pendingAnimation
            )
            if (!this.isTreeAnimating) {
                this.targetDelta = this.relativeTarget = undefined
            }

            if (!this.layout || !(layout || layoutId)) return

            /**
             * Reset the corrected box with the latest values from box, as we're then going
             * to perform mutative operations on it.
             */
            copyBoxInto(this.layoutCorrected, this.layout.layoutBox)

            /**
             * Record previous tree scales before updating.
             */
            const prevTreeScaleX = this.treeScale.x
            const prevTreeScaleY = this.treeScale.y
            /**
             * Apply all the parent deltas to this box to produce the corrected box. This
             * is the layout box, as it will appear on screen as a result of the transforms of its parents.
             */
            applyTreeDeltas(
                this.layoutCorrected,
                this.treeScale,
                this.path,
                isShared
            )

            /**
             * If this layer needs to perform scale correction but doesn't have a target,
             * use the layout as the target.
             */
            if (
                lead.layout &&
                !lead.target &&
                (this.treeScale.x !== 1 || this.treeScale.y !== 1)
            ) {
                lead.target = lead.layout.layoutBox
                lead.targetWithTransforms = createBox()
            }

            const { target } = lead

            if (!target) {
                /**
                 * If we don't have a target to project into, but we were previously
                 * projecting, we want to remove the stored transform and schedule
                 * a render to ensure the elements reflect the removed transform.
                 */
                if (this.prevProjectionDelta) {
                    this.createProjectionDeltas()
                    this.scheduleRender()
                }

                return
            }

            if (!this.projectionDelta || !this.prevProjectionDelta) {
                this.createProjectionDeltas()
            } else {
                copyAxisDeltaInto(
                    this.prevProjectionDelta.x,
                    this.projectionDelta.x
                )
                copyAxisDeltaInto(
                    this.prevProjectionDelta.y,
                    this.projectionDelta.y
                )
            }

            /**
             * Update the delta between the corrected box and the target box before user-set transforms were applied.
             * This will allow us to calculate the corrected borderRadius and boxShadow to compensate
             * for our layout reprojection, but still allow them to be scaled correctly by the user.
             * It might be that to simplify this we may want to accept that user-set scale is also corrected
             * and we wouldn't have to keep and calc both deltas, OR we could support a user setting
             * to allow people to choose whether these styles are corrected based on just the
             * layout reprojection or the final bounding box.
             */
            calcBoxDelta(
                this.projectionDelta!,
                this.layoutCorrected,
                target,
                this.latestValues
            )

            if (
                this.treeScale.x !== prevTreeScaleX ||
                this.treeScale.y !== prevTreeScaleY ||
                !axisDeltaEquals(
                    this.projectionDelta!.x,
                    this.prevProjectionDelta!.x
                ) ||
                !axisDeltaEquals(
                    this.projectionDelta!.y,
                    this.prevProjectionDelta!.y
                )
            ) {
                this.hasProjected = true
                this.scheduleRender()
                this.notifyListeners("projectionUpdate", target)
            }

            /**
             * Increase debug counter for recalculated projections
             */
            if (isDebug) {
                metrics.recalculatedProjection++
            }
        }

        isVisible = true
        hide() {
            this.isVisible = false
            // TODO: Schedule render
        }
        show() {
            this.isVisible = true
            // TODO: Schedule render
        }

        scheduleRender(notifyAll = true) {
            this.options.visualElement?.scheduleRender()
            if (notifyAll) {
                const stack = this.getStack()
                stack && stack.scheduleRender()
            }
            if (this.resumingFrom && !this.resumingFrom.instance) {
                this.resumingFrom = undefined
            }
        }

        createProjectionDeltas() {
            this.prevProjectionDelta = createDelta()
            this.projectionDelta = createDelta()
            this.projectionDeltaWithTransform = createDelta()
        }

        /**
         * Animation
         */
        animationValues?: ResolvedValues
        pendingAnimation?: Process
        currentAnimation?: AnimationPlaybackControls
        mixTargetDelta: (progress: number) => void
        animationProgress = 0

        setAnimationOrigin(
            delta: Delta,
            hasOnlyRelativeTargetChanged: boolean = false
        ) {
            const snapshot = this.snapshot
            const snapshotLatestValues = snapshot
                ? snapshot.latestValues
                : undefined || {}
            const mixedValues = { ...this.latestValues }

            const targetDelta = createDelta()
            if (
                !this.relativeParent ||
                !this.relativeParent.options.layoutRoot
            ) {
                this.relativeTarget = this.relativeTargetOrigin = undefined
            }
            this.attemptToResolveRelativeTarget = !hasOnlyRelativeTargetChanged

            const relativeLayout = createBox()

            const snapshotSource = snapshot ? snapshot.source : undefined
            const layoutSource = this.layout ? this.layout.source : undefined
            const isSharedLayoutAnimation = snapshotSource !== layoutSource
            const stack = this.getStack()
            const isOnlyMember = !stack || stack.members.length <= 1
            const shouldCrossfadeOpacity = Boolean(
                isSharedLayoutAnimation &&
                    !isOnlyMember &&
                    this.options.crossfade === true &&
                    !this.path.some(hasOpacityCrossfade)
            )

            this.animationProgress = 0

            let prevRelativeTarget: Box

            this.mixTargetDelta = (latest: number) => {
                const progress = latest / 1000

                mixAxisDelta(targetDelta.x, delta.x, progress)
                mixAxisDelta(targetDelta.y, delta.y, progress)
                this.setTargetDelta(targetDelta)

                if (
                    this.relativeTarget &&
                    this.relativeTargetOrigin &&
                    this.layout &&
                    this.relativeParent &&
                    this.relativeParent.layout
                ) {
                    calcRelativePosition(
                        relativeLayout,
                        this.layout.layoutBox,
                        this.relativeParent.layout.layoutBox
                    )
                    mixBox(
                        this.relativeTarget,
                        this.relativeTargetOrigin,
                        relativeLayout,
                        progress
                    )

                    /**
                     * If this is an unchanged relative target we can consider the
                     * projection not dirty.
                     */
                    if (
                        prevRelativeTarget &&
                        boxEquals(this.relativeTarget, prevRelativeTarget)
                    ) {
                        this.isProjectionDirty = false
                    }

                    if (!prevRelativeTarget) prevRelativeTarget = createBox()
                    copyBoxInto(prevRelativeTarget, this.relativeTarget)
                }

                if (isSharedLayoutAnimation) {
                    this.animationValues = mixedValues

                    mixValues(
                        mixedValues,
                        snapshotLatestValues,
                        this.latestValues,
                        progress,
                        shouldCrossfadeOpacity,
                        isOnlyMember
                    )
                }

                this.root.scheduleUpdateProjection()
                this.scheduleRender()

                this.animationProgress = progress
            }

            this.mixTargetDelta(this.options.layoutRoot ? 1000 : 0)
        }

        startAnimation(options: ValueAnimationOptions<number>) {
            this.notifyListeners("animationStart")

            this.currentAnimation && this.currentAnimation.stop()
            if (this.resumingFrom && this.resumingFrom.currentAnimation) {
                this.resumingFrom.currentAnimation.stop()
            }
            if (this.pendingAnimation) {
                cancelFrame(this.pendingAnimation)
                this.pendingAnimation = undefined
            }

            /**
             * Start the animation in the next frame to have a frame with progress 0,
             * where the target is the same as when the animation started, so we can
             * calculate the relative positions correctly for instant transitions.
             */
            this.pendingAnimation = frame.update(() => {
                globalProjectionState.hasAnimatedSinceResize = true

                this.currentAnimation = animateSingleValue(0, animationTarget, {
                    ...(options as any),
                    onUpdate: (latest: number) => {
                        this.mixTargetDelta(latest)
                        options.onUpdate && options.onUpdate(latest)
                    },
                    onComplete: () => {
                        options.onComplete && options.onComplete()
                        this.completeAnimation()
                    },
                })

                if (this.resumingFrom) {
                    this.resumingFrom.currentAnimation = this.currentAnimation
                }

                this.pendingAnimation = undefined
            })
        }

        completeAnimation() {
            if (this.resumingFrom) {
                this.resumingFrom.currentAnimation = undefined
                this.resumingFrom.preserveOpacity = undefined
            }

            const stack = this.getStack()
            stack && stack.exitAnimationComplete()
            this.resumingFrom =
                this.currentAnimation =
                this.animationValues =
                    undefined

            this.notifyListeners("animationComplete")
        }

        finishAnimation() {
            if (this.currentAnimation) {
                this.mixTargetDelta && this.mixTargetDelta(animationTarget)
                this.currentAnimation.stop()
            }

            this.completeAnimation()
        }

        applyTransformsToTarget() {
            const lead = this.getLead()
            let { targetWithTransforms, target, layout, latestValues } = lead

            if (!targetWithTransforms || !target || !layout) return

            /**
             * If we're only animating position, and this element isn't the lead element,
             * then instead of projecting into the lead box we instead want to calculate
             * a new target that aligns the two boxes but maintains the layout shape.
             */
            if (
                this !== lead &&
                this.layout &&
                layout &&
                shouldAnimatePositionOnly(
                    this.options.animationType,
                    this.layout.layoutBox,
                    layout.layoutBox
                )
            ) {
                target = this.target || createBox()

                const xLength = calcLength(this.layout!.layoutBox.x)
                target!.x.min = lead.target!.x.min
                target!.x.max = target.x.min + xLength

                const yLength = calcLength(this.layout!.layoutBox.y)
                target!.y.min = lead.target!.y.min
                target!.y.max = target.y.min + yLength
            }

            copyBoxInto(targetWithTransforms, target)

            /**
             * Apply the latest user-set transforms to the targetBox to produce the targetBoxFinal.
             * This is the final box that we will then project into by calculating a transform delta and
             * applying it to the corrected box.
             */
            transformBox(targetWithTransforms, latestValues)

            /**
             * Update the delta between the corrected box and the final target box, after
             * user-set transforms are applied to it. This will be used by the renderer to
             * create a transform style that will reproject the element from its layout layout
             * into the desired bounding box.
             */
            calcBoxDelta(
                this.projectionDeltaWithTransform!,
                this.layoutCorrected,
                targetWithTransforms!,
                latestValues
            )
        }

        /**
         * Shared layout
         */
        // TODO Only running on root node
        sharedNodes: Map<string, NodeStack> = new Map()
        registerSharedNode(layoutId: string, node: IProjectionNode) {
            if (!this.sharedNodes.has(layoutId)) {
                this.sharedNodes.set(layoutId, new NodeStack())
            }

            const stack = this.sharedNodes.get(layoutId)!
            stack.add(node)

            const config = node.options.initialPromotionConfig
            node.promote({
                transition: config ? config.transition : undefined,
                preserveFollowOpacity:
                    config && config.shouldPreserveFollowOpacity
                        ? config.shouldPreserveFollowOpacity(node)
                        : undefined,
            })
        }

        isLead(): boolean {
            const stack = this.getStack()
            return stack ? stack.lead === this : true
        }

        getLead() {
            const { layoutId } = this.options
            return layoutId ? this.getStack()?.lead || this : this
        }

        getPrevLead() {
            const { layoutId } = this.options
            return layoutId ? this.getStack()?.prevLead : undefined
        }

        getStack() {
            const { layoutId } = this.options
            if (layoutId) return this.root.sharedNodes.get(layoutId)
        }

        promote({
            needsReset,
            transition,
            preserveFollowOpacity,
        }: {
            needsReset?: boolean
            transition?: Transition
            preserveFollowOpacity?: boolean
        } = {}) {
            const stack = this.getStack()
            if (stack) stack.promote(this, preserveFollowOpacity)

            if (needsReset) {
                this.projectionDelta = undefined
                this.needsReset = true
            }
            if (transition) this.setOptions({ transition })
        }

        relegate(): boolean {
            const stack = this.getStack()
            if (stack) {
                return stack.relegate(this)
            } else {
                return false
            }
        }

        resetSkewAndRotation() {
            const { visualElement } = this.options

            if (!visualElement) return

            // If there's no detected skew or rotation values, we can early return without a forced render.
            let hasDistortingTransform = false

            /**
             * An unrolled check for rotation values. Most elements don't have any rotation and
             * skipping the nested loop and new object creation is 50% faster.
             */
            const { latestValues } = visualElement
            if (
                latestValues.z ||
                latestValues.rotate ||
                latestValues.rotateX ||
                latestValues.rotateY ||
                latestValues.rotateZ ||
                latestValues.skewX ||
                latestValues.skewY
            ) {
                hasDistortingTransform = true
            }

            // If there's no distorting values, we don't need to do any more.
            if (!hasDistortingTransform) return

            const resetValues: ResolvedValues = {}

            if (latestValues.z) {
                resetDistortingTransform(
                    "z",
                    visualElement,
                    resetValues,
                    this.animationValues
                )
            }

            // Check the skew and rotate value of all axes and reset to 0
            for (let i = 0; i < transformAxes.length; i++) {
                resetDistortingTransform(
                    `rotate${transformAxes[i]}`,
                    visualElement,
                    resetValues,
                    this.animationValues
                )
                resetDistortingTransform(
                    `skew${transformAxes[i]}`,
                    visualElement,
                    resetValues,
                    this.animationValues
                )
            }

            // Force a render of this element to apply the transform with all skews and rotations
            // set to 0.
            visualElement.render()

            // Put back all the values we reset
            for (const key in resetValues) {
                visualElement.setStaticValue(key, resetValues[key])
                if (this.animationValues) {
                    this.animationValues[key] = resetValues[key]
                }
            }

            // Schedule a render for the next frame. This ensures we won't visually
            // see the element with the reset rotate value applied.
            visualElement.scheduleRender()
        }

        getProjectionStyles(styleProp?: MotionStyle) {
            if (!this.instance || this.isSVG) return undefined

            if (!this.isVisible) {
                return hiddenVisibility
            }

            const styles: ResolvedValues = {
                visibility: "",
            }

            const transformTemplate = this.getTransformTemplate()

            if (this.needsReset) {
                this.needsReset = false

                styles.opacity = ""
                styles.pointerEvents =
                    resolveMotionValue(styleProp?.pointerEvents) || ""
                styles.transform = transformTemplate
                    ? transformTemplate(this.latestValues, "")
                    : "none"
                return styles
            }

            const lead = this.getLead()
            if (!this.projectionDelta || !this.layout || !lead.target) {
                const emptyStyles: ResolvedValues = {}
                if (this.options.layoutId) {
                    emptyStyles.opacity =
                        this.latestValues.opacity !== undefined
                            ? this.latestValues.opacity
                            : 1
                    emptyStyles.pointerEvents =
                        resolveMotionValue(styleProp?.pointerEvents) || ""
                }
                if (this.hasProjected && !hasTransform(this.latestValues)) {
                    emptyStyles.transform = transformTemplate
                        ? transformTemplate({}, "")
                        : "none"
                    this.hasProjected = false
                }

                return emptyStyles
            }

            const valuesToRender = lead.animationValues || lead.latestValues
            this.applyTransformsToTarget()

            styles.transform = buildProjectionTransform(
                this.projectionDeltaWithTransform!,
                this.treeScale,
                valuesToRender
            )

            if (transformTemplate) {
                styles.transform = transformTemplate(
                    valuesToRender,
                    styles.transform
                )
            }

            const { x, y } = this.projectionDelta
            styles.transformOrigin = `${x.origin * 100}% ${y.origin * 100}% 0`

            if (lead.animationValues) {
                /**
                 * If the lead component is animating, assign this either the entering/leaving
                 * opacity
                 */
                styles.opacity =
                    lead === this
                        ? valuesToRender.opacity ??
                          this.latestValues.opacity ??
                          1
                        : this.preserveOpacity
                        ? this.latestValues.opacity
                        : valuesToRender.opacityExit
            } else {
                /**
                 * Or we're not animating at all, set the lead component to its layout
                 * opacity and other components to hidden.
                 */
                styles.opacity =
                    lead === this
                        ? valuesToRender.opacity !== undefined
                            ? valuesToRender.opacity
                            : ""
                        : valuesToRender.opacityExit !== undefined
                        ? valuesToRender.opacityExit
                        : 0
            }

            /**
             * Apply scale correction
             */
            for (const key in scaleCorrectors) {
                if (valuesToRender[key] === undefined) continue

                const { correct, applyTo } = scaleCorrectors[key]

                /**
                 * Only apply scale correction to the value if we have an
                 * active projection transform. Otherwise these values become
                 * vulnerable to distortion if the element changes size without
                 * a corresponding layout animation.
                 */
                const corrected =
                    styles.transform === "none"
                        ? valuesToRender[key]
                        : correct(valuesToRender[key], lead)

                if (applyTo) {
                    const num = applyTo.length
                    for (let i = 0; i < num; i++) {
                        styles[applyTo[i]] = corrected
                    }
                } else {
                    styles[key] = corrected
                }
            }

            /**
             * Disable pointer events on follow components. This is to ensure
             * that if a follow component covers a lead component it doesn't block
             * pointer events on the lead.
             */
            if (this.options.layoutId) {
                styles.pointerEvents =
                    lead === this
                        ? resolveMotionValue(styleProp?.pointerEvents) || ""
                        : "none"
            }

            return styles
        }

        clearSnapshot() {
            this.resumeFrom = this.snapshot = undefined
        }

        // Only run on root
        resetTree() {
            this.root.nodes!.forEach((node: IProjectionNode) =>
                node.currentAnimation?.stop()
            )
            this.root.nodes!.forEach(clearMeasurements)
            this.root.sharedNodes.clear()
        }
    }
}

function updateLayout(node: IProjectionNode) {
    node.updateLayout()
}

function notifyLayoutUpdate(node: IProjectionNode) {
    const snapshot = node.resumeFrom?.snapshot || node.snapshot

    if (
        node.isLead() &&
        node.layout &&
        snapshot &&
        node.hasListeners("didUpdate")
    ) {
        const { layoutBox: layout, measuredBox: measuredLayout } = node.layout
        const { animationType } = node.options

        const isShared = snapshot.source !== node.layout.source

        // TODO Maybe we want to also resize the layout snapshot so we don't trigger
        // animations for instance if layout="size" and an element has only changed position
        if (animationType === "size") {
            eachAxis((axis) => {
                const axisSnapshot = isShared
                    ? snapshot.measuredBox[axis]
                    : snapshot.layoutBox[axis]
                const length = calcLength(axisSnapshot)
                axisSnapshot.min = layout[axis].min
                axisSnapshot.max = axisSnapshot.min + length
            })
        } else if (
            shouldAnimatePositionOnly(animationType, snapshot.layoutBox, layout)
        ) {
            eachAxis((axis) => {
                const axisSnapshot = isShared
                    ? snapshot.measuredBox[axis]
                    : snapshot.layoutBox[axis]
                const length = calcLength(layout[axis])
                axisSnapshot.max = axisSnapshot.min + length

                /**
                 * Ensure relative target gets resized and rerendererd
                 */
                if (node.relativeTarget && !node.currentAnimation) {
                    node.isProjectionDirty = true
                    node.relativeTarget[axis].max =
                        node.relativeTarget[axis].min + length
                }
            })
        }

        const layoutDelta = createDelta()

        calcBoxDelta(layoutDelta, layout, snapshot.layoutBox)
        const visualDelta = createDelta()
        if (isShared) {
            calcBoxDelta(
                visualDelta,
                node.applyTransform(measuredLayout, true),
                snapshot.measuredBox
            )
        } else {
            calcBoxDelta(visualDelta, layout, snapshot.layoutBox)
        }

        const hasLayoutChanged = !isDeltaZero(layoutDelta)
        let hasRelativeTargetChanged = false

        if (!node.resumeFrom) {
            const relativeParent = node.getClosestProjectingParent()

            /**
             * If the relativeParent is itself resuming from a different element then
             * the relative snapshot is not relavent
             */
            if (relativeParent && !relativeParent.resumeFrom) {
                const { snapshot: parentSnapshot, layout: parentLayout } =
                    relativeParent

                if (parentSnapshot && parentLayout) {
                    const relativeSnapshot = createBox()
                    calcRelativePosition(
                        relativeSnapshot,
                        snapshot.layoutBox,
                        parentSnapshot.layoutBox
                    )

                    const relativeLayout = createBox()
                    calcRelativePosition(
                        relativeLayout,
                        layout,
                        parentLayout.layoutBox
                    )

                    if (!boxEqualsRounded(relativeSnapshot, relativeLayout)) {
                        hasRelativeTargetChanged = true
                    }

                    if (relativeParent.options.layoutRoot) {
                        node.relativeTarget = relativeLayout
                        node.relativeTargetOrigin = relativeSnapshot
                        node.relativeParent = relativeParent
                    }
                }
            }
        }

        node.notifyListeners("didUpdate", {
            layout,
            snapshot,
            delta: visualDelta,
            layoutDelta,
            hasLayoutChanged,
            hasRelativeTargetChanged,
        })
    } else if (node.isLead()) {
        const { onExitComplete } = node.options
        onExitComplete && onExitComplete()
    }

    /**
     * Clearing transition
     * TODO: Investigate why this transition is being passed in as {type: false } from Framer
     * and why we need it at all
     */
    node.options.transition = undefined
}

export function propagateDirtyNodes(node: IProjectionNode) {
    /**
     * Increase debug counter for nodes encountered this frame
     */
    if (isDebug) {
        metrics.totalNodes++
    }

    if (!node.parent) return

    /**
     * If this node isn't projecting, propagate isProjectionDirty. It will have
     * no performance impact but it will allow the next child that *is* projecting
     * but *isn't* dirty to just check its parent to see if *any* ancestor needs
     * correcting.
     */
    if (!node.isProjecting()) {
        node.isProjectionDirty = node.parent.isProjectionDirty
    }

    /**
     * Propagate isSharedProjectionDirty and isTransformDirty
     * throughout the whole tree. A future revision can take another look at
     * this but for safety we still recalcualte shared nodes.
     */
    node.isSharedProjectionDirty ||= Boolean(
        node.isProjectionDirty ||
            node.parent.isProjectionDirty ||
            node.parent.isSharedProjectionDirty
    )

    node.isTransformDirty ||= node.parent.isTransformDirty
}

export function cleanDirtyNodes(node: IProjectionNode) {
    node.isProjectionDirty =
        node.isSharedProjectionDirty =
        node.isTransformDirty =
            false
}

function clearSnapshot(node: IProjectionNode) {
    node.clearSnapshot()
}

function clearMeasurements(node: IProjectionNode) {
    node.clearMeasurements()
}

function clearIsLayoutDirty(node: IProjectionNode) {
    node.isLayoutDirty = false
}

function resetTransformStyle(node: IProjectionNode) {
    const { visualElement } = node.options
    if (visualElement && visualElement.getProps().onBeforeLayoutMeasure) {
        visualElement.notify("BeforeLayoutMeasure")
    }

    node.resetTransform()
}

function finishAnimation(node: IProjectionNode) {
    node.finishAnimation()
    node.targetDelta = node.relativeTarget = node.target = undefined
    node.isProjectionDirty = true
}

function resolveTargetDelta(node: IProjectionNode) {
    node.resolveTargetDelta()
}

function calcProjection(node: IProjectionNode) {
    node.calcProjection()
}

function resetSkewAndRotation(node: IProjectionNode) {
    node.resetSkewAndRotation()
}

function removeLeadSnapshots(stack: NodeStack) {
    stack.removeLeadSnapshot()
}

export function mixAxisDelta(output: AxisDelta, delta: AxisDelta, p: number) {
    output.translate = mixNumber(delta.translate, 0, p)
    output.scale = mixNumber(delta.scale, 1, p)
    output.origin = delta.origin
    output.originPoint = delta.originPoint
}

export function mixAxis(output: Axis, from: Axis, to: Axis, p: number) {
    output.min = mixNumber(from.min, to.min, p)
    output.max = mixNumber(from.max, to.max, p)
}

export function mixBox(output: Box, from: Box, to: Box, p: number) {
    mixAxis(output.x, from.x, to.x, p)
    mixAxis(output.y, from.y, to.y, p)
}

function hasOpacityCrossfade(node: IProjectionNode) {
    return (
        node.animationValues && node.animationValues.opacityExit !== undefined
    )
}

const defaultLayoutTransition = {
    duration: 0.45,
    ease: [0.4, 0, 0.1, 1],
}

const userAgentContains = (string: string) =>
    typeof navigator !== "undefined" &&
    navigator.userAgent &&
    navigator.userAgent.toLowerCase().includes(string)

/**
 * Measured bounding boxes must be rounded in Safari and
 * left untouched in Chrome, otherwise non-integer layouts within scaled-up elements
 * can appear to jump.
 */
const roundPoint =
    userAgentContains("applewebkit/") && !userAgentContains("chrome/")
        ? Math.round
        : noop

function roundAxis(axis: Axis): void {
    // Round to the nearest .5 pixels to support subpixel layouts
    axis.min = roundPoint(axis.min)
    axis.max = roundPoint(axis.max)
}

function roundBox(box: Box): void {
    roundAxis(box.x)
    roundAxis(box.y)
}

function shouldAnimatePositionOnly(
    animationType: string | undefined,
    snapshot: Box,
    layout: Box
) {
    return (
        animationType === "position" ||
        (animationType === "preserve-aspect" &&
            !isNear(aspectRatio(snapshot), aspectRatio(layout), 0.2))
    )
}

function checkNodeWasScrollRoot(node: IProjectionNode) {
    return node !== node.root && node.scroll?.wasRoot
}
