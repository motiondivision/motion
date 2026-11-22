import {
    Axis,
    AxisDelta,
    Box,
    Delta,
    Point,
    SubscriptionManager,
} from "motion-utils"
import {
    MultiValueRef,
    startValueAnimation,
} from "../../animation/animate/multi-value"
import { spring } from "../../animation/generators/spring"
import { calcGeneratorDuration } from "../../animation/generators/utils/calc-duration"
import { notifyLayoutAnimationStart } from "../../animation/utils/notify-inspector"
import { getOptimisedAppearId } from "../../animation/optimized-appear/get-appear-id"
import {
    AnimationPlaybackControlsWithThen,
    MotionPath,
    PathInterpolator,
    Transition,
    ValueAnimationOptions,
} from "../../animation/types"
import { getValueTransition } from "../../animation/utils/get-value-transition"
import { cancelFrame, frame, frameData } from "../../frameloop"
import { flushFrame } from "../../frameloop/flush-frame"
import { microtask } from "../../frameloop/microtask"
import { time } from "../../frameloop/sync-time"
import type { Process } from "../../frameloop/types"
import type { MotionNodeOptions } from "../../node/types"
import type { ResolvedValues } from "../../render/types"
import { scaleCorrectors } from "../../render/utils/is-forced-motion-value"
import { transformProps } from "../../render/utils/keys-transform"
import type { MotionStyle, VisualElement } from "../../render/VisualElement"
import { statsBuffer } from "../../stats/buffer"
import { delay } from "../../utils/delay"
import { isRefObject } from "../../utils/is-ref-object"
import { isSVGElement } from "../../utils/is-svg-element"
import { isSVGSVGElement } from "../../utils/is-svg-svg-element"
import { mixNumber } from "../../utils/mix/number"
import { MotionValue, motionValue } from "../../value"
import {
    pointToProgressVelocity,
    resolveAutoMass,
} from "../animation/layout-velocity"
import {
    compositorLayers,
    transformGroups,
} from "../../animation/waapi/transforms/groups"
import { copyAxisDeltaInto, copyAxisInto, copyBoxInto } from "../geometry/copy"
import {
    applyBoxDelta,
    applyTreeDeltas,
    transformBox,
    translateAxis,
} from "../geometry/delta-apply"
import {
    calcBoxDelta,
    calcLength,
    calcRelativeBox,
    calcRelativePosition,
} from "../geometry/delta-calc"
import { removeBoxTransforms } from "../geometry/delta-remove"
import { roundBox } from "../geometry/round"
import { createBox, createDelta } from "../geometry/models"
import {
    axisDeltaEquals,
    boxEquals,
    boxEqualsRounded,
    isDeltaZero,
    shouldAnimatePositionOnly,
} from "../geometry/utils"
import type { NodeStack } from "../shared/stack"
import { buildProjectionTransform } from "../styles/transform"
import { eachAxis } from "../utils/each-axis"
import { FlatTree } from "../utils/flat-tree"
import {
    angleTransforms,
    has2DTranslate,
    hasDistortingTransform,
    hasScale,
    hasTransform,
} from "../utils/has-transform"
import { globalProjectionState } from "./state"
import {
    InitialPromotionConfig,
    IProjectionNode,
    LayoutEvents,
    LayoutUpdateData,
    Measurements,
    Phase,
    ProjectionNodeConfig,
    ProjectionNodeOptions,
    ScrollMeasurements,
} from "./types"

const animationTarget = 1000
const layerBudget = 250

let layers = 0
const countLayer = (node: IProjectionNode) => {
    node.isProjecting() && layers++
}
const giveLayer = (node: IProjectionNode) => {
    node.hasLayer = node.isProjecting() && layers-- <= layerBudget
}

let id = 0

const demoteTransforms = (node: IProjectionNode) =>
    node.instance &&
    transformGroups.get(node.instance)?.demote() &&
    node.resetSkewAndRotation()

function cloneBox(box: Box, dest = createBox()): Box {
    copyBoxInto(dest, box)
    return dest
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

function getClosestProjectingNode(
    visualElement?: VisualElement<
        unknown,
        unknown,
        { allowProjection?: boolean }
    >
): IProjectionNode | undefined {
    if (!visualElement) return undefined

    return visualElement.options.allowProjection !== false
        ? visualElement.projection
        : getClosestProjectingNode(visualElement.parent)
}

/**
 * Create a core FLIP projection node class.
 *
 * Handles single-element and parent-child FLIP `layout` animations without
 * bundling shared-element (`layoutId`, `NodeStack`, `mixValues` crossfade)
 * or default scale correctors (`borderRadius`, `boxShadow`).
 *
 * Compose with `withSharedLayout` (or use `createProjectionNode`) to enable
 * shared-element `layoutId` transitions.
 */
export function createBasicProjectionNode<I>({
    attachResizeListener,
    defaultParent,
    measureScroll,
    checkIsScrollRoot,
    resetTransform,
}: ProjectionNodeConfig<I>) {
    return class ProjectionNode implements IProjectionNode<I> {
        static create(
            visualElement: VisualElement<any>,
            props: MotionNodeOptions,
            initialPromotionConfig?: InitialPromotionConfig
        ) {
            const {
                layoutId,
                layout,
                drag,
                dragConstraints,
                layoutScroll,
                layoutRoot,
                layoutAnchor,
                layoutCrossfade,
            } = props

            const projection = (visualElement.projection = new this(
                visualElement.latestValues,
                props["data-framer-portal-id"]
                    ? undefined
                    : getClosestProjectingNode(visualElement.parent)
            ) as IProjectionNode)

            projection.setOptions({
                layoutId,
                layout,
                alwaysMeasureLayout:
                    !!drag || (dragConstraints && isRefObject(dragConstraints)),
                visualElement,
                animationType: typeof layout === "string" ? layout : "both",
                initialPromotionConfig,
                crossfade: layoutCrossfade,
                layoutScroll,
                layoutRoot,
                layoutAnchor,
            })

            const lead = projection.getStack()?.lead
            if (lead && !projection.root!.isUpdateBlocked()) {
                lead.willUpdate()
                lead.scheduleCheckAfterUnmount()
            }
        }

        id: number = id++

        animationId: number
        animationCommitId: number

        instance: I | undefined
        root: IProjectionNode
        parent?: IProjectionNode
        path: IProjectionNode[]
        children = new Set<IProjectionNode>()
        options: ProjectionNodeOptions = {}

        snapshot: Measurements | undefined
        layout: Measurements | undefined
        dragSnapshot: Measurements | undefined
        dragAncestor: IProjectionNode | undefined
        targetLayout?: Box
        layoutCorrected: Box
        targetDelta?: Delta
        target?: Box
        relativeTarget?: Box
        relativeTargetOrigin?: Box
        relativeParent?: IProjectionNode

        declare isTreeAnimating: boolean
        declare isAnimationBlocked: boolean
        attemptToResolveRelativeTarget?: boolean
        targetWithTransforms?: Box
        prevProjectionDelta?: Delta
        projectionDelta?: Delta
        projectionDeltaWithTransform?: Delta
        scroll?: ScrollMeasurements

        isLayoutDirty: boolean
        isProjectionDirty: boolean
        declare isSharedProjectionDirty: boolean
        declare isTransformDirty: boolean
        declare updateManuallyBlocked: boolean
        declare updateBlockedByResize: boolean
        isUpdating: boolean
        declare isSVG: boolean
        declare needsReset: boolean
        needsShow?: boolean
        declare shouldResetTransform: boolean
        declare hasCheckedOptimisedAppear: boolean

        treeScale: Point = { x: 1, y: 1 }

        resumeFrom?: IProjectionNode
        resumingFrom?: IProjectionNode
        latestValues: ResolvedValues
        eventHandlers = new Map<LayoutEvents, SubscriptionManager<any>>()
        nodes?: FlatTree
        depth: number
        prevTransformTemplateValue: string | undefined
        preserveOpacity?: boolean
        declare hasTreeAnimated: boolean
        hasLayoutListener?: boolean
        inTree?: boolean

        declare updateScheduled: boolean
        declare scheduleUpdate: () => void
        declare projectionUpdateScheduled: boolean
        declare hasLayer?: boolean
        declare updateProjection: () => void
        declare resolvedRelativeTargetAt: number
        declare hasProjected: boolean
        declare written: ResolvedValues
        declare isVisible: boolean

        animationValues?: ResolvedValues
        pendingAnimation?: Process
        currentAnimation?: AnimationPlaybackControlsWithThen
        mixTargetDelta: (progress: number) => void
        declare animationProgress: number

        animationEdges?: number[]
        startVelocity?: number | number[]
        edgeValues?: number[]
        edgeVelocity?: (i: number) => number
        relativeVelocity?: number[]
        relativeTime?: number
        relativeStart?: number[]
        impulse?: number
        isSpringLayout?: boolean

        motionValue?: MotionValue<number>

        declare sharedNodes: Map<string, NodeStack>
        declare stacksChanged: number

        /**
         * Optional extension hooks overridden by `withSharedLayout`.
         */
        mixShared?(
            snapshot: Measurements | undefined
        ): ((progress: number) => void) | undefined
        alignTarget?(lead: IProjectionNode, target: Box): Box
        applySharedBefore?(
            lead: IProjectionNode,
            targetStyle: any,
            styleProp: MotionStyle | undefined,
            write: (key: string, value: any) => void,
            setLayer: (isLayer?: boolean) => void,
            transformTemplate:
                | ((transform: any, generated: string) => string)
                | undefined
        ): boolean
        applySharedStyles?(
            write: (key: string, value: any) => void,
            styleProp: MotionStyle | undefined,
            lead?: IProjectionNode,
            valuesToRender?: ResolvedValues
        ): void

        constructor(
            latestValues: ResolvedValues = {},
            parent: IProjectionNode | undefined = defaultParent?.()
        ) {
            this.animationId = this.animationCommitId = 0
            this.isLayoutDirty = this.isProjectionDirty = this.isUpdating = false
            this.latestValues = latestValues
            this.root = parent ? parent.root || parent : this
            this.path = parent ? [...parent.path, parent] : []
            this.parent = parent

            this.depth = parent ? parent.depth + 1 : 0

            for (let i = 0; i < this.path.length; i++) {
                this.path[i].shouldResetTransform = true
            }

            if (this.root === this) {
                this.nodes = new FlatTree()
                this.scheduleUpdate = () => this.update()
                this.updateProjection = () => {
                    this.projectionUpdateScheduled = false

                    this.nodes!.forEach(propagateDirtyNodes)
                    this.nodes!.forEach(resolveTargetDelta)
                    this.nodes!.forEach(calcProjection)
                    this.nodes!.forEach(cleanDirtyNodes)

                    layers = compositorLayers
                    this.nodes!.forEach(countLayer)
                    this.nodes!.forEach(giveLayer)

                    statsBuffer.countProjection?.()
                }
            }
        }

        addEventListener(name: LayoutEvents, handler: any) {
            if (!this.eventHandlers.has(name)) {
                this.eventHandlers.set(name, new SubscriptionManager())
            }

            return this.eventHandlers.get(name)!.add(handler)
        }

        notifyListeners(name: LayoutEvents, ...args: any) {
            this.eventHandlers.get(name)?.notify(...args)
        }

        hasListeners(name: LayoutEvents) {
            return this.eventHandlers.has(name)
        }

        /**
         * Lifecycles
         */
        mount(instance: I) {
            if (this.instance) return

            this.isSVG = isSVGElement(instance) && !isSVGSVGElement(instance)

            this.instance = instance
            this.written = {}

            const { layoutId, layout, visualElement } = this.options
            if (visualElement && !visualElement.current) {
                visualElement.mount(instance)
            }

            this.inTree ? this.root.nodes!.add(this) : joinTree(this)
            this.parent?.children.add(this)

            if (this.root.hasTreeAnimated && (layout || layoutId)) {
                this.isLayoutDirty = true
            }

            if (attachResizeListener) {
                let cancelDelay: VoidFunction
                let innerWidth = 0

                const resizeUnblockUpdate = () =>
                    (this.root.updateBlockedByResize = false)

                frame.read(() => {
                    innerWidth = window.innerWidth
                })

                attachResizeListener(instance, () => {
                    const newInnerWidth = window.innerWidth
                    if (newInnerWidth === innerWidth) return

                    innerWidth = newInnerWidth

                    this.root.updateBlockedByResize = true

                    cancelDelay?.()
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

            this.addLayoutListener()
        }

        addLayoutListener() {
            const { layoutId, layout, visualElement, animate } = this.options

            if (
                !this.instance ||
                this.hasLayoutListener ||
                animate === false ||
                !visualElement ||
                !(layoutId || layout)
            )
                return

            this.hasLayoutListener = true
            this.addEventListener(
                "didUpdate",
                ({
                    delta,
                    hasLayoutChanged,
                    hasRelativeLayoutChanged,
                    layout: newLayout,
                }: LayoutUpdateData) => {
                    if (this.isAnimationBlocked) {
                        this.target = this.relativeTarget = undefined
                        return
                    }

                    const layoutTransition =
                        this.options.transition ||
                        visualElement.getDefaultTransition() ||
                        defaultLayoutTransition

                    const {
                        onLayoutAnimationStart,
                        onLayoutAnimationComplete,
                    } = visualElement.getProps()

                    const hasTargetChanged =
                        !this.targetLayout ||
                        !boxEqualsRounded(this.targetLayout, newLayout)

                    const hasOnlyRelativeTargetChanged =
                        !hasLayoutChanged && hasRelativeLayoutChanged

                    if (
                        this.options.layoutRoot ||
                        this.resumeFrom ||
                        hasOnlyRelativeTargetChanged ||
                        (hasLayoutChanged &&
                            (hasTargetChanged || !this.currentAnimation))
                    ) {
                        if (this.resumeFrom) {
                            this.resumingFrom = this.resumeFrom
                            this.resumingFrom.resumingFrom = undefined
                        }

                        const animationOptions = {
                            ...getValueTransition(layoutTransition, "layout"),
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
                        this.setAnimationOrigin(
                            delta,
                            hasOnlyRelativeTargetChanged,
                            (animationOptions as { path?: MotionPath }).path
                        )
                    } else {
                        if (!hasLayoutChanged) {
                            finishAnimation(this)
                        }

                        this.isLead() && this.options.onExitComplete?.()
                    }

                    this.targetLayout = newLayout
                }
            )
        }

        unmount() {
            this.options.layoutId && this.willUpdate(true, true)
            this.root.nodes!.remove(this)
            this.getStack()?.remove(this)
            this.parent?.children.delete(this)
            this.instance = undefined
            this.eventHandlers.clear()
            this.hasLayoutListener = false

            this.updateProjection && cancelFrame(this.updateProjection)
        }

        blockUpdate() {
            this.updateManuallyBlocked = true
        }

        unblockUpdate() {
            this.updateManuallyBlocked = false
        }

        isUpdateBlocked() {
            return !!(this.updateManuallyBlocked || this.updateBlockedByResize)
        }

        startUpdate(isUnmount?: boolean) {
            if (this.isUpdateBlocked()) return

            this.isUpdating = true

            this.nodes?.forEach(resetSkewAndRotation)
            this.animationId++

            isUnmount || this.nodes?.forEach(snapshotDragged)
        }

        getTransformTemplate() {
            return this.options.visualElement?.getProps().transformTemplate
        }

        willUpdate(shouldNotifyListeners = true, isUnmount?: boolean) {
            this.root.hasTreeAnimated = true
            joinTree(this, true)

            if (this.root.isUpdateBlocked()) {
                this.options.onExitComplete?.()
                return
            }

            if (
                window.MotionCancelOptimisedAnimation &&
                !this.hasCheckedOptimisedAppear
            ) {
                cancelTreeOptimisedTransformAnimations(this)
            }

            !this.root.isUpdating && this.root.startUpdate(isUnmount)

            if (this.isLayoutDirty) return

            demoteTransforms(this)

            this.isLayoutDirty = true
            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                prepareAncestor(node)

                if (node.options.layoutRoot) {
                    node.willUpdate(false)
                }

                if (node.isAnimationBlocked) {
                    node.dragSnapshot ||= node.measure()
                    this.dragAncestor = node
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

        update() {
            this.updateScheduled = false

            if (this.isUpdateBlocked()) {
                const wasBlockedByResize = this.updateBlockedByResize

                this.unblockUpdate()
                this.updateBlockedByResize = false
                this.clearAllSnapshots()

                if (wasBlockedByResize) {
                    this.nodes!.forEach(forceLayoutMeasure)
                }

                this.nodes!.forEach(clearMeasurements)
                return
            }

            if (this.animationId <= this.animationCommitId) {
                this.nodes!.forEach(clearIsLayoutDirty)
                return
            }

            this.animationCommitId = this.animationId

            if (!this.isUpdating) {
                this.nodes!.forEach(clearIsLayoutDirty)
            } else {
                this.isUpdating = false

                this.nodes!.forEach(ensureDraggedNodesSnapshotted)
                this.nodes!.forEach(syncRelativeLayout)
                this.nodes!.forEach(resetTransformStyle)
                this.nodes!.forEach(updateLayout)
                this.nodes!.forEach(notifyLayoutUpdate)
            }

            this.clearAllSnapshots()

            flushFrame()
        }

        didUpdate() {
            if (!this.updateScheduled) {
                this.updateScheduled = true
                microtask.read(this.scheduleUpdate)
            }
        }

        clearAllSnapshots() {
            this.nodes!.forEach(clearSnapshot)
        }

        scheduleUpdateProjection() {
            if (!this.projectionUpdateScheduled) {
                this.projectionUpdateScheduled = true
                frame.preRender(this.updateProjection, false, true)
            }
        }

        scheduleCheckAfterUnmount() {
            frame.postRender(() => {
                if (this.isLayoutDirty) {
                    this.root.didUpdate()
                } else {
                    this.root.checkUpdateFailed()
                }
            })
        }

        checkUpdateFailed() {
            if (this.isUpdating) {
                this.isUpdating = false
                this.clearAllSnapshots()
            }
        }

        updateSnapshot() {
            if (this.snapshot || !this.instance) return

            const snapshot = this.measure()
            const { x, y } = snapshot.measuredBox

            this.snapshot =
                calcLength(x) || calcLength(y) ? snapshot : undefined

            if (this.snapshot) {
                const { visualElement } = this.options
                const isRunning = this.currentAnimation?.state === "running"
                const edges = isRunning && this.animationEdges

                if (isRunning && this.relativeTarget) {
                    this.snapshot.relativeVelocity =
                        this.relativeVelocity?.slice() || []
                }

                const value = this.motionValue as any
                const progress =
                    (edges &&
                        (value.current - value.prevFrameValue) /
                            (value.updatedAt - value.prevUpdatedAt)) ||
                    0
                const velocity = [0, 1, 2, 3, 4, 5].map(
                    (i) =>
                        (i < 4
                            ? edges &&
                              (this.edgeValues
                                  ? this.edgeVelocity!(i)
                                  : -edges[i] * progress)
                            : visualElement
                                  ?.getValue(i < 5 ? "x" : "y")
                                  ?.getVelocity()) || 0
                )
                if (velocity.some(Boolean)) this.snapshot.velocity = velocity
            }
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

            if (this.resumeFrom && !this.resumeFrom.instance) {
                for (let i = 0; i < this.path.length; i++) {
                    this.path[i].updateScroll()
                }
            }

            const prevLayout = this.layout
            this.layout = this.measure(false)
            if (!this.layoutCorrected) this.layoutCorrected = createBox()
            this.isLayoutDirty = false
            this.projectionDelta = undefined
            this.notifyListeners("measure", this.layout.layoutBox)

            this.options.visualElement?.notify(
                "LayoutMeasure",
                this.layout.layoutBox,
                prevLayout?.layoutBox
            )
        }

        updateScroll(phase: Phase = "measure") {
            const { scroll, instance } = this
            const { animationId } = this.root

            if (
                this.options.layoutScroll &&
                instance &&
                !(
                    scroll &&
                    scroll.animationId === animationId &&
                    scroll.phase === phase
                )
            ) {
                const isRoot = checkIsScrollRoot(instance)
                this.scroll = {
                    animationId,
                    phase,
                    isRoot,
                    offset: measureScroll(instance),
                    wasRoot: scroll ? scroll.isRoot : isRoot,
                }
            }
        }

        resetTransform() {
            if (!resetTransform) return

            const isResetRequested =
                this.isLayoutDirty ||
                this.shouldResetTransform ||
                this.options.alwaysMeasureLayout

            isResetRequested && demoteTransforms(this)

            const hasProjection =
                this.projectionDelta && !isDeltaZero(this.projectionDelta)

            const transformTemplate = this.getTransformTemplate()
            const transformTemplateValue = transformTemplate
                ? transformTemplate(this.latestValues, "")
                : undefined

            if (
                isResetRequested &&
                this.instance &&
                (hasProjection ||
                    hasTransform(this.latestValues) ||
                    transformTemplateValue !== this.prevTransformTemplateValue)
            ) {
                resetTransform(this.instance, transformTemplateValue)
                this.shouldResetTransform = false
                this.scheduleRender()
            }
        }

        measure(removeTransform = true) {
            const pageBox = this.measurePageBox()

            let layoutBox = this.removeElementScroll(pageBox)

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
                const { scroll } = this.root
                if (scroll) {
                    translateAxis(box.x, scroll.offset.x)
                    translateAxis(box.y, scroll.offset.y)
                }
            }

            return box
        }

        removeElementScroll(box: Box): Box {
            const boxWithoutScroll = cloneBox(box)

            if (this.scroll?.wasRoot) {
                return boxWithoutScroll
            }

            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                const { scroll, options } = node

                if (node !== this.root && scroll && options.layoutScroll) {
                    if (scroll.wasRoot) {
                        copyBoxInto(boxWithoutScroll, box)
                    }

                    translateAxis(boxWithoutScroll.x, scroll.offset.x)
                    translateAxis(boxWithoutScroll.y, scroll.offset.y)
                }
            }

            return boxWithoutScroll
        }

        applyTransform(
            box: Box,
            transformOnly = false,
            output?: Box,
            skipOwnTransform?: boolean,
            start = 0
        ): Box {
            const withTransforms = cloneBox(box, output)
            for (let i = start; i < this.path.length; i++) {
                const node = this.path[i]

                if (
                    !transformOnly &&
                    node.options.layoutScroll &&
                    node.scroll &&
                    node !== node.root
                ) {
                    translateAxis(withTransforms.x, -node.scroll.offset.x)
                    translateAxis(withTransforms.y, -node.scroll.offset.y)
                }

                if (!hasTransform(node.latestValues)) continue
                transformBox(
                    withTransforms,
                    node.latestValues,
                    node.layout?.layoutBox
                )
            }

            if (!skipOwnTransform && hasTransform(this.latestValues)) {
                transformBox(
                    withTransforms,
                    this.latestValues,
                    this.layout?.layoutBox
                )
            }

            return withTransforms
        }

        removeTransform(box: Box): Box {
            const boxWithoutTransform = cloneBox(box)

            for (let i = 0; i < this.path.length; i++) {
                const node = this.path[i]
                if (!hasTransform(node.latestValues)) continue

                let sourceBox: Box | undefined

                if (node.instance) {
                    hasScale(node.latestValues) && node.updateSnapshot()
                    sourceBox = cloneBox(node.measurePageBox())
                }

                removeBoxTransforms(
                    boxWithoutTransform,
                    node.latestValues,
                    node.snapshot?.layoutBox,
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
            this.options = { ...this.options, ...options }
            this.addLayoutListener()
            joinTree(this)
        }

        clearMeasurements() {
            this.scroll =
                this.layout =
                this.snapshot =
                this.prevTransformTemplateValue =
                this.targetDelta =
                this.target =
                    undefined
            this.isLayoutDirty = false
        }

        forceRelativeParentToResolveTarget() {
            const { relativeParent } = this

            relativeParent &&
                relativeParent.resolvedRelativeTargetAt !==
                    frameData.timestamp &&
                relativeParent.resolveTargetDelta(true)
        }

        resolveTargetDelta(forceRecalculation = false) {
            const lead = this.getLead()
            if (lead !== this) {
                this.isProjectionDirty ||= lead.isProjectionDirty
                this.isTransformDirty ||= lead.isTransformDirty
                this.isSharedProjectionDirty ||= lead.isSharedProjectionDirty
            }

            const isShared = !!this.resumingFrom || this !== lead

            if (
                !(
                    forceRecalculation ||
                    (isShared && this.isSharedProjectionDirty) ||
                    this.isProjectionDirty ||
                    this.parent?.isProjectionDirty ||
                    this.attemptToResolveRelativeTarget ||
                    this.root.updateBlockedByResize
                )
            )
                return

            const { layout, layoutId } = this.options

            if (!this.layout || !(layout || layoutId)) return

            this.resolvedRelativeTargetAt = frameData.timestamp

            const relativeParent = this.getClosestProjectingParent()

            if (!this.targetDelta && !this.relativeTarget) {
                if (
                    this.options.layoutAnchor !== false &&
                    relativeParent?.layout
                ) {
                    this.createRelativeTarget(
                        relativeParent,
                        this.layout.layoutBox,
                        relativeParent.layout.layoutBox
                    )
                } else {
                    this.removeRelativeTarget()
                }
            }

            if (!this.relativeTarget && !this.targetDelta) return

            if (!this.target) {
                this.target = createBox()
                this.targetWithTransforms = createBox()
            }

            if (
                this.relativeTarget &&
                this.relativeTargetOrigin &&
                this.relativeParent?.target
            ) {
                this.forceRelativeParentToResolveTarget()

                calcRelativeBox(
                    this.target,
                    this.relativeTarget,
                    this.relativeParent.target,
                    this.options.layoutAnchor || undefined
                )
            } else if (this.targetDelta) {
                if (this.resumingFrom) {
                    this.applyTransform(
                        this.layout.layoutBox,
                        false,
                        this.target,
                        true
                    )
                } else {
                    copyBoxInto(this.target, this.layout.layoutBox)
                }

                applyBoxDelta(this.target, this.targetDelta)
            } else {
                copyBoxInto(this.target, this.layout.layoutBox)
            }

            if (this.attemptToResolveRelativeTarget) {
                this.attemptToResolveRelativeTarget = false

                if (
                    this.options.layoutAnchor !== false &&
                    relativeParent &&
                    (!relativeParent.resumingFrom === !this.resumingFrom ||
                        (relativeParent.options.layoutRoot &&
                            !relativeParent.resumingFrom)) &&
                    !relativeParent.options.layoutScroll &&
                    relativeParent.target &&
                    this.animationProgress !== 1
                ) {
                    this.createRelativeTarget(
                        relativeParent,
                        this.target,
                        relativeParent.target
                    )
                } else {
                    this.relativeParent = this.relativeTarget = undefined
                }
            }

            statsBuffer.countProjection?.(1)
        }

        getClosestProjectingParent() {
            if (
                !this.parent ||
                hasScale(this.parent.latestValues) ||
                has2DTranslate(this.parent.latestValues)
            ) {
                return undefined
            }

            return this.parent.isProjecting()
                ? this.parent
                : this.parent.getClosestProjectingParent()
        }

        isProjecting() {
            return !!(
                (this.relativeTarget ||
                    this.targetDelta ||
                    this.options.layoutRoot) &&
                this.layout
            )
        }

        createRelativeTarget(
            relativeParent: IProjectionNode,
            layout: Box,
            parentLayout: Box
        ) {
            this.relativeParent = relativeParent
            this.forceRelativeParentToResolveTarget()
            this.relativeTargetOrigin = createBox()
            calcRelativePosition(
                this.relativeTargetOrigin,
                layout,
                parentLayout,
                this.options.layoutAnchor || undefined
            )
            this.relativeTarget = cloneBox(this.relativeTargetOrigin)
        }

        removeRelativeTarget() {
            this.relativeParent = this.relativeTarget = undefined
        }

        prepareFlush(node: any) {
            if (node.isProjectionPending) {
                node.isProjectionPending = false
                node.isAllPending || node.queueAll(isProjectionStyle)
            }
            if (node.numPending || node.isAllPending) this.written = {}
        }

        calcProjection() {
            const lead = this.getLead()
            const isShared = !!this.resumingFrom || this !== lead

            if (
                !(
                    this.isProjectionDirty ||
                    this.parent?.isProjectionDirty ||
                    (isShared &&
                        (this.isSharedProjectionDirty ||
                            this.isTransformDirty)) ||
                    this.resolvedRelativeTargetAt === frameData.timestamp
                )
            )
                return

            const { layout, layoutId } = this.options

            this.isTreeAnimating = !!(
                this.parent?.isTreeAnimating ||
                this.currentAnimation ||
                this.pendingAnimation
            )
            if (!this.isTreeAnimating) {
                this.targetDelta = this.relativeTarget = undefined
            }

            if (!this.layout || !(layout || layoutId)) return

            copyBoxInto(this.layoutCorrected, this.layout.layoutBox)

            const prevTreeScaleX = this.treeScale.x
            const prevTreeScaleY = this.treeScale.y

            applyTreeDeltas(
                this.layoutCorrected,
                this.treeScale,
                this.path,
                isShared &&
                    (lead.relativeTarget && !lead.relativeParent!.resumingFrom
                        ? lead.relativeParent
                        : true)
            )

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

            statsBuffer.countProjection?.(2)
        }

        hide() {
            this.isVisible = false
        }
        show() {
            this.isVisible = true
        }

        scheduleRender(notifyAll = true) {
            const ve = this.options.visualElement
            if (ve?.current) {
                ve.isProjectionPending = true
                ve.requestFlush()
            }
            if (notifyAll) {
                this.getStack()?.scheduleRender()
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

        setAnimationOrigin(
            delta: Delta,
            hasOnlyRelativeTargetChanged: boolean = false,
            pathFn?: MotionPath
        ) {
            const snapshot = this.snapshot
            const targetDelta = createDelta()
            if (!this.relativeParent?.options.layoutRoot) {
                this.relativeTarget = this.relativeTargetOrigin = undefined
            }
            this.attemptToResolveRelativeTarget = !hasOnlyRelativeTargetChanged

            const relativeLayout = createBox()

            const sharedMixer = this.mixShared?.(snapshot)
            const isSharedLayoutAnimation = !!sharedMixer

            this.animationProgress = 0

            let prevRelativeTarget: Box

            const interpolate: PathInterpolator | undefined =
                pathFn?.interpolateProjection(delta)

            const box = this.layout?.layoutBox
            let edges =
                box &&
                [box.x.min, box.x.max, box.y.min, box.y.max].map((edge, i) => {
                    const { translate, scale, originPoint } =
                        delta[i < 2 ? "x" : "y"]
                    return (edge - originPoint) * (scale - 1) + translate
                })
            if (!edges?.every(isFinite)) edges = undefined
            this.animationEdges = edges
            this.edgeValues =
                this.startVelocity =
                this.impulse =
                this.relativeVelocity =
                this.relativeStart =
                    undefined

            const velocity = snapshot?.velocity
            const relative = snapshot?.relativeVelocity || velocity
            if (
                relative?.slice(0, 4).some(Boolean) &&
                this.getClosestProjectingParent()
            ) {
                this.relativeStart = relative
            }
            if (velocity && edges) {
                const v = velocity
                    .slice(0, 4)
                    .map(
                        (edge, i) =>
                            edge +
                            (isSharedLayoutAnimation
                                ? velocity[4 + (i >> 1)]
                                : 0)
                    )
                if (v.some(Boolean)) {
                    this.startVelocity = interpolate
                        ? pointToProgressVelocity(
                              delta.x.translate,
                              delta.y.translate,
                              { x: (v[0] + v[1]) / 2, y: (v[2] + v[3]) / 2 }
                          )
                        : v
                }
            }

            this.mixTargetDelta = (latest: number) => {
                const progress = latest / 1000
                const point = interpolate?.(progress)
                const values = this.edgeValues

                for (let i = 0; i < 2; i++) {
                    const axis = i ? "y" : "x"
                    values
                        ? edgesToDelta(
                              targetDelta[axis],
                              delta[axis],
                              this.layout!.layoutBox[axis],
                              values[i * 2],
                              values[i * 2 + 1]
                          )
                        : mixAxisDeltaLinear(
                              targetDelta[axis],
                              delta[axis],
                              progress
                          )
                }

                if (point) {
                    targetDelta.x.translate = point.x
                    targetDelta.y.translate = point.y
                }

                this.setTargetDelta(targetDelta)

                if (
                    this.relativeTarget &&
                    this.relativeTargetOrigin &&
                    this.layout &&
                    this.relativeParent?.layout
                ) {
                    calcRelativePosition(
                        relativeLayout,
                        this.layout.layoutBox,
                        this.relativeParent.layout.layoutBox,
                        this.options.layoutAnchor || undefined
                    )
                    mixBox(
                        this.relativeTarget,
                        this.relativeTargetOrigin,
                        relativeLayout,
                        progress
                    )

                    if (this.isSpringLayout) {
                        const box = this.relativeTarget
                        const impulse = this.impulse || 0
                        const start = this.relativeStart
                        const now = time.now()
                        const dt = (now - this.relativeTime!) / 1000
                        this.relativeTime = now
                        const speeds = (this.relativeVelocity ||= [0, 0, 0, 0])
                        for (let i = 0; i < 4; i++) {
                            const axis = i < 2 ? "x" : "y"
                            const edge = i & 1 ? "max" : "min"
                            if (start) box[axis][edge] += start[i] * impulse
                            if (prevRelativeTarget && dt > 0) {
                                speeds[i] =
                                    (box[axis][edge] -
                                        prevRelativeTarget[axis][edge]) /
                                    dt
                            }
                        }
                    }

                    if (
                        prevRelativeTarget &&
                        boxEquals(this.relativeTarget, prevRelativeTarget)
                    ) {
                        this.isProjectionDirty = false
                    }

                    prevRelativeTarget = cloneBox(
                        this.relativeTarget,
                        prevRelativeTarget
                    )
                }

                sharedMixer?.(progress)

                if (point?.rotate !== undefined) {
                    this.animationValues ||= { ...this.latestValues }
                    this.animationValues.pathRotation = point.rotate
                }

                this.animationValues && this.scheduleRender()

                this.animationProgress = progress
            }

            this.mixTargetDelta(this.options.layoutRoot ? 1000 : 0)
        }

        startAnimation(options: ValueAnimationOptions<number>) {
            this.notifyListeners("animationStart")

            const isSpring = (this.isSpringLayout = options.type === "spring")

            const { transition: clockKey } = this.options
            this.currentAnimation?.stop()
            if (this.resumingFrom) {
                this.resumingFrom.currentAnimation?.stop()
                this.resumingFrom.edgeValues = undefined
            }

            this.pendingAnimation && cancelFrame(this.pendingAnimation)

            this.pendingAnimation = frame.update(() => {
                globalProjectionState.hasAnimatedSinceResize = true

                this.motionValue ||= motionValue(0)
                this.motionValue.jump(0, false)

                const velocity = this.startVelocity
                this.startVelocity = undefined

                let transition: any = options
                let mainVelocity = 0

                if (isSpring) {
                    if (options.mass === "auto") {
                        const box = this.layout?.layoutBox
                        transition = resolveAutoMass(
                            options,
                            box &&
                                Math.sqrt(calcLength(box.x) * calcLength(box.y))
                        )
                    }

                    const relative = this.relativeStart
                    if ((velocity || relative) && !options.repeat) {
                        if (typeof velocity === "number") {
                            mainVelocity = velocity
                        } else {
                            const edges = velocity && this.animationEdges!
                            transition = {
                                ...transition,
                                type: (o: any) => {
                                    const springs = [
                                        o.velocity,
                                        ...(velocity || []),
                                    ].map((v, i) =>
                                        spring({
                                            ...o,
                                            keyframes: i
                                                ? [edges![i - 1], 0]
                                                : o.keyframes,
                                            velocity: v,
                                        })
                                    )
                                    const count = springs.length
                                    relative &&
                                        springs.push(
                                            spring({
                                                ...o,
                                                keyframes: [0, 0],
                                                velocity: 1000,
                                                restDelta: 0.5,
                                                restSpeed: 5,
                                            })
                                        )
                                    let tNow = 0
                                    const values: number[] = []
                                    const generator = {
                                        calculatedDuration: null as
                                            | number
                                            | null,
                                        next: (t: number) => {
                                            tNow = t
                                            const state = springs[0].next(t)
                                            let done = state.done
                                            for (
                                                let i = 1;
                                                i < springs.length;
                                                i++
                                            ) {
                                                const { value, done: rest } =
                                                    springs[i].next(t)
                                                if (i < count) {
                                                    values[i - 1] = value
                                                } else {
                                                    this.impulse = value / 1000
                                                }
                                                done = done && rest
                                            }
                                            if (edges) this.edgeValues = values
                                            state.done = done
                                            return state
                                        },
                                    }
                                    generator.calculatedDuration =
                                        calcGeneratorDuration(generator)
                                    generator.next(0)
                                    this.edgeVelocity = (i) =>
                                        springs[i + 1].velocity!(tNow)
                                    return generator
                                },
                            }
                        }
                    }
                }

                this.motionValue.run(
                    startValueAnimation(
                        getLayoutClock(clockKey),
                        "",
                        this.motionValue,
                        [0, 1000],
                        {
                            ...transition,
                            velocity: mainVelocity,
                            isSync: true,
                            onUpdate: (latest: number) => {
                                this.mixTargetDelta(latest)
                                options.onUpdate?.(latest)
                            },
                            onComplete: () => {
                                options.onComplete?.()
                                this.completeAnimation()
                            },
                        }
                    )
                )

                this.currentAnimation = this.motionValue.animation as any

                notifyLayoutAnimationStart(this.currentAnimation, this)

                if (this.resumingFrom) {
                    this.resumingFrom.currentAnimation = this.currentAnimation
                }

                this.pendingAnimation = undefined
            })
        }

        completeAnimation() {
            if (this.resumingFrom) {
                this.resumingFrom.currentAnimation =
                    this.resumingFrom.preserveOpacity = undefined
            }

            this.getStack()?.exitAnimationComplete()
            this.resumingFrom =
                this.currentAnimation =
                this.animationValues =
                this.edgeValues =
                this.edgeVelocity =
                this.impulse =
                    undefined

            this.notifyListeners("animationComplete")
        }

        finishAnimation() {
            if (this.currentAnimation) {
                this.edgeValues = this.impulse = undefined
                this.mixTargetDelta?.(animationTarget)
                this.currentAnimation.stop()
            }

            this.completeAnimation()
        }

        applyTransformsToTarget() {
            const lead = this.getLead()
            const { targetWithTransforms, layout, latestValues } = lead
            let { target } = lead

            if (!targetWithTransforms || !target || !layout) return

            if (this !== lead && this.alignTarget) {
                target = this.alignTarget(lead, target)
            }

            copyBoxInto(targetWithTransforms, target)
            transformBox(targetWithTransforms, latestValues)

            calcBoxDelta(
                this.projectionDeltaWithTransform!,
                this.layoutCorrected,
                targetWithTransforms,
                latestValues
            )
        }

        /**
         * Shared layout no-op defaults (overridden by `withSharedLayout`)
         */
        registerSharedNode(_layoutId: string, _node: IProjectionNode) {}
        isLead(): boolean {
            return true
        }
        getLead(): IProjectionNode {
            return this
        }
        getStack(): NodeStack | undefined {
            return undefined
        }
        promote(_options?: {
            needsReset?: boolean
            transition?: Transition
            preserveFollowOpacity?: boolean
        }) {}
        relegate(): boolean {
            return false
        }

        resetSkewAndRotation() {
            const { visualElement } = this.options
            if (!visualElement) return

            const { latestValues } = visualElement
            if (!hasDistortingTransform(latestValues)) return

            const resetValues: ResolvedValues = {}

            ;["z", "skew", "skewZ", ...angleTransforms].forEach((key) => {
                if (latestValues[key]) {
                    resetValues[key] = latestValues[key]
                    visualElement.setStaticValue(key, 0)
                    if (this.animationValues) this.animationValues[key] = 0
                }
            })

            visualElement.render()

            for (const key in resetValues) {
                visualElement.setStaticValue(key, resetValues[key])
                if (this.animationValues) {
                    this.animationValues[key] = resetValues[key]
                }
            }

            visualElement.scheduleRender()
        }

        applyProjectionStyles(targetStyle: any, styleProp?: MotionStyle) {
            if (!this.instance || this.isSVG) return

            const { written } = this
            const write = (key: string, value: any) => {
                if (written[key] !== value) {
                    targetStyle[key] = written[key] = value
                }
            }

            const lead = this.getLead()
            const transformTemplate = this.getTransformTemplate()

            const setLayer = (isLayer?: boolean) =>
                (isLayer || written.willChange) &&
                !styleProp?.willChange &&
                !this.latestValues.willChange &&
                write("willChange", isLayer ? "transform" : "")

            if (
                this.applySharedBefore?.(
                    lead,
                    targetStyle,
                    styleProp,
                    write,
                    setLayer,
                    transformTemplate
                )
            ) {
                return
            }

            if (!this.projectionDelta || !this.layout || !lead.target) {
                this.applySharedStyles?.(write, styleProp)
                if (this.hasProjected && !hasTransform(this.latestValues)) {
                    targetStyle.transform = transformTemplate
                        ? transformTemplate({}, "")
                        : "none"
                    this.hasProjected = false
                }
                setLayer()
                return
            }

            const valuesToRender = lead.animationValues || lead.latestValues

            const delta =
                lead !== this ||
                hasScale(this.latestValues) ||
                has2DTranslate(this.latestValues)
                    ? (this.applyTransformsToTarget(),
                      this.projectionDeltaWithTransform!)
                    : this.projectionDelta

            let transform = buildProjectionTransform(
                delta,
                this.treeScale,
                valuesToRender
            )

            setLayer(transform !== "none" && this.hasLayer)

            if (transformTemplate) {
                transform = transformTemplate(valuesToRender, transform)
            }

            targetStyle.transform = transform

            const { x, y } = this.projectionDelta
            write("transformOrigin", `${x.origin * 100}% ${y.origin * 100}% 0`)

            this.applySharedStyles?.(write, styleProp, lead, valuesToRender)

            for (const key in scaleCorrectors) {
                if (valuesToRender[key] === undefined) continue

                const { correct, applyTo, isCSSVariable } = scaleCorrectors[key]

                const corrected =
                    transform === "none"
                        ? valuesToRender[key]
                        : correct(valuesToRender[key], lead)

                if (applyTo) {
                    const num = applyTo.length
                    for (let i = 0; i < num; i++) {
                        targetStyle[applyTo[i] as any] = corrected
                    }
                } else if (isCSSVariable) {
                    targetStyle.setProperty(key, corrected)
                } else {
                    targetStyle[key as any] = corrected
                }
            }
        }

        clearSnapshot() {
            this.resumeFrom =
                this.snapshot =
                this.dragSnapshot =
                this.dragAncestor =
                    undefined
        }

        resetTree() {
            this.root.nodes!.forEach(stopAnimation)
            this.root.nodes!.forEach(clearMeasurements)
        }
    }
}

function joinTree(node: IProjectionNode, force?: boolean) {
    const { options } = node

    if (
        !node.inTree &&
        (force ||
            options.layout ||
            options.layoutId ||
            options.alwaysMeasureLayout ||
            !node.parent ||
            options.visualElement?.getProps().onBeforeLayoutMeasure)
    ) {
        node.inTree = true
        node.parent && joinTree(node.parent, true)

        if (node.instance) {
            node.root!.nodes!.add(node)
            force && node.root!.isUpdating && node.resetSkewAndRotation()
        }
    }
}

function updateLayout(node: IProjectionNode) {
    node.updateLayout()
    followDraggedAncestor(node)
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

        const resizeSnapshot = (box: Box, to: Box) => {
            if (animationType === "size") {
                eachAxis((axis) => {
                    const length = calcLength(box[axis])
                    box[axis].min = to[axis].min
                    box[axis].max = box[axis].min + length
                })
            } else if (animationType === "x" || animationType === "y") {
                const snapAxis = animationType === "x" ? "y" : "x"
                copyAxisInto(box[snapAxis], to[snapAxis])
            } else if (
                shouldAnimatePositionOnly(
                    animationType,
                    snapshot.layoutBox,
                    layout
                )
            ) {
                eachAxis((axis) => {
                    const length = calcLength(to[axis])
                    box[axis].max = box[axis].min + length

                    if (node.relativeTarget && !node.currentAnimation) {
                        node.isProjectionDirty = true
                        node.relativeTarget[axis].max =
                            node.relativeTarget[axis].min + length
                    }
                })
            }
        }

        const snapshotBox = isShared ? snapshot.measuredBox : snapshot.layoutBox
        resizeSnapshot(snapshotBox, layout)

        const layoutDelta = createDelta()
        calcBoxDelta(layoutDelta, layout, snapshot.layoutBox)

        let visualDelta = layoutDelta
        if (isShared) {
            visualDelta = createDelta()
            calcBoxDelta(
                visualDelta,
                node.applyTransform(measuredLayout, true),
                snapshotBox
            )
        }

        const hasLayoutChanged = !isDeltaZero(layoutDelta)
        let hasRelativeLayoutChanged = false
        const relativeParent = node.getClosestProjectingParent()

        if (
            (!isShared ||
                (relativeParent?.options.layoutRoot &&
                    node.resumeFrom?.path.includes(relativeParent))) &&
            relativeParent &&
            !relativeParent.resumeFrom
        ) {
            const { snapshot: parentSnapshot, layout: parentLayout } =
                relativeParent

            if (parentSnapshot && parentLayout) {
                const anchor = node.options.layoutAnchor || undefined

                const relativeSnapshot = createBox()
                calcRelativePosition(
                    relativeSnapshot,
                    isShared
                        ? node.resumeFrom!.applyTransform(
                              snapshot.layoutBox,
                              true,
                              undefined,
                              true,
                              relativeParent.depth + 1
                          )
                        : snapshot.layoutBox,
                    parentSnapshot.layoutBox,
                    anchor
                )

                const relativeLayout = createBox()
                calcRelativePosition(
                    relativeLayout,
                    layout,
                    parentLayout.layoutBox,
                    anchor
                )

                isShared && resizeSnapshot(relativeSnapshot, relativeLayout)

                if (!boxEqualsRounded(relativeSnapshot, relativeLayout)) {
                    hasRelativeLayoutChanged = true
                }

                if (relativeParent.options.layoutRoot) {
                    node.relativeTarget = relativeLayout
                    node.relativeTargetOrigin = relativeSnapshot
                    node.relativeParent = relativeParent
                }
            }
        }

        node.notifyListeners("didUpdate", {
            layout,
            snapshot,
            delta: visualDelta,
            layoutDelta,
            hasLayoutChanged,
            hasRelativeLayoutChanged,
        })
    } else if (node.isLead()) {
        node.options.onExitComplete?.()
    }

    node.options.transition = undefined
}

export function propagateDirtyNodes(node: IProjectionNode) {
    statsBuffer.countProjection?.(0)

    if (!node.parent) return

    if (!node.isProjecting()) {
        node.isProjectionDirty = node.parent.isProjectionDirty
    }

    node.isSharedProjectionDirty ||= !!(
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

function stopAnimation(node: IProjectionNode) {
    node.currentAnimation?.stop()
}

function clearSnapshot(node: IProjectionNode) {
    node.clearSnapshot()
}

function clearMeasurements(node: IProjectionNode) {
    node.clearMeasurements()
}

function forceLayoutMeasure(node: IProjectionNode) {
    node.isLayoutDirty = true
    node.updateLayout()
}

function clearIsLayoutDirty(node: IProjectionNode) {
    node.isLayoutDirty = false
}

function followDraggedAncestor(node: IProjectionNode) {
    const { snapshot, dragAncestor } = node
    const to = dragAncestor?.isAnimationBlocked && dragAncestor.layout
    if (!snapshot || !to || node.resumeFrom || node.isAnimationBlocked) return

    const from = dragAncestor!.dragSnapshot!
    eachAxis((axis) =>
        translateAxis(
            snapshot.layoutBox[axis],
            to.layoutBox[axis].min - from.layoutBox[axis].min
        )
    )
}

function prepareAncestor(node: IProjectionNode) {
    node.shouldResetTransform = true
    demoteTransforms(node)

    if (
        typeof node.latestValues.x === "string" ||
        typeof node.latestValues.y === "string"
    ) {
        node.isLayoutDirty = true
    }

    node.updateScroll("snapshot")
}

function snapshotDragged(node: IProjectionNode) {
    if (node.isAnimationBlocked && node.layout) {
        node.path.forEach(prepareAncestor)
        demoteTransforms(node)
        node.dragSnapshot = node.measure()
    }
}

function ensureDraggedNodesSnapshotted(node: IProjectionNode) {
    if (node.isAnimationBlocked && node.layout && !node.isLayoutDirty) {
        node.snapshot = node.dragSnapshot || node.layout
        node.isLayoutDirty = true
    }
}

function syncRelativeLayout(node: IProjectionNode) {
    if (node.relativeTarget && node.relativeParent?.isLayoutDirty) {
        if (node.currentAnimation) {
            node.isLayoutDirty = true
        } else {
            node.targetDelta = undefined
            node.removeRelativeTarget()
        }
    }
}

function resetTransformStyle(node: IProjectionNode) {
    const { visualElement } = node.options
    if (visualElement?.getProps().onBeforeLayoutMeasure) {
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

function edgesToDelta(
    output: AxisDelta,
    delta: AxisDelta,
    layout: Axis,
    min: number,
    max: number
) {
    const length = layout.max - layout.min
    const scale = length ? Math.max(0, (length + max - min) / length) : 1
    const origin = (output.originPoint = delta.originPoint)
    output.origin = delta.origin
    output.scale = scale
    output.translate =
        layout.min + min - (origin + (layout.min - origin) * scale)
}

function mixAxisDeltaLinear(output: AxisDelta, delta: AxisDelta, p: number) {
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

const isProjectionStyle = (key: string) =>
    transformProps.has(key) ||
    !!scaleCorrectors[key] ||
    /^(transform|origin|opacity|visibility|pointerEvents)/.test(key)

let clocks: Map<unknown, MultiValueRef> | undefined

function getLayoutClock(key: unknown) {
    if (!clocks) {
        clocks = new Map()
        frame.update(startLayoutClocks, false, true)
    }
    let ref = clocks.get(key)
    ref || clocks.set(key, (ref = {}))
    return ref
}

function startLayoutClocks() {
    const started = clocks!
    clocks = undefined
    started.forEach((ref) => ref.animation?.start())
}

const defaultLayoutTransition = {
    duration: 0.45,
    ease: [0.4, 0, 0.1, 1],
}

function checkNodeWasScrollRoot(node: IProjectionNode) {
    return node !== node.root && node.scroll?.wasRoot
}
