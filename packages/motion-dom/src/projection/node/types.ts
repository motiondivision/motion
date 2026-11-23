import type {
    AnimationPlaybackControlsWithThen,
    MotionPath,
    Transition,
    ValueTransition,
} from "../../animation/types"
import type { ResolvedValues } from "../../render/types"
import type { VisualElement, MotionStyle } from "../../render/VisualElement"
import { Box, Delta, Point } from "motion-utils"
import { FlatTree } from "../utils/flat-tree"
import { NodeStack } from "../shared/stack"

export interface Measurements {
    animationId: number
    measuredBox: Box
    layoutBox: Box
    latestValues: ResolvedValues
    source: number
    /**
     * Velocity (px/s) when measured, for the next spring layout animation.
     * velocity is [x min, x max, y min, y max, x value, y value] in the
     * page, and is only set when something moves. relativeVelocity is
     * [x min, x max, y min, y max] inside the parent, for a child that was
     * moving inside an animating parent.
     */
    velocity?: number[]
    relativeVelocity?: number[]
}

export type Phase = "snapshot" | "measure"

export interface ScrollMeasurements {
    animationId: number
    phase: Phase
    offset: Point
    isRoot: boolean
    wasRoot: boolean
}

export type LayoutEvents =
    | "willUpdate"
    | "didUpdate"
    | "beforeMeasure"
    | "measure"
    | "projectionUpdate"
    | "animationStart"
    | "animationComplete"

export interface IProjectionNode<I = unknown> {
    /**
     * Set on drag's measure-only nodes (domDrag and vanilla `drag()`),
     * which measure layout but don't project or join the tree.
     */
    isMeasureOnly?: boolean
    /**
     * Measure-only nodes: hand active listeners to the full node that
     * replaces this one.
     */
    upgrade?: (node: [IProjectionNode, VoidFunction?]) => void
    id: number
    animationId: number
    animationCommitId: number
    parent?: IProjectionNode
    relativeParent?: IProjectionNode
    root?: IProjectionNode
    children: Set<IProjectionNode>
    path: IProjectionNode[]
    nodes?: FlatTree
    inTree?: boolean
    depth: number
    instance: I | undefined
    mount: (node: I, isLayoutDirty?: boolean) => void
    unmount: () => void
    options: ProjectionNodeOptions
    setOptions(options: ProjectionNodeOptions): void
    layout?: Measurements
    dragSnapshot?: Measurements
    dragAncestor?: IProjectionNode
    snapshot?: Measurements
    target?: Box
    relativeTarget?: Box
    relativeTargetOrigin?: Box
    targetDelta?: Delta
    targetWithTransforms?: Box
    scroll?: ScrollMeasurements
    treeScale?: Point
    projectionDelta?: Delta
    projectionDeltaWithTransform?: Delta
    latestValues: ResolvedValues
    isLayoutDirty: boolean
    isProjectionDirty: boolean
    isSharedProjectionDirty: boolean
    isTransformDirty: boolean
    resolvedRelativeTargetAt?: number
    shouldResetTransform: boolean
    prevTransformTemplateValue: string | undefined
    isUpdateBlocked(): boolean
    updateManuallyBlocked: boolean
    updateBlockedByResize: boolean
    blockUpdate(): void
    unblockUpdate(): void
    isUpdating: boolean
    pageBoxes?: Map<IProjectionNode, Box>
    needsReset: boolean
    written: ResolvedValues
    prepareFlush(node: any): void
    needsShow?: boolean
    startUpdate(isUnmount?: boolean): void
    willUpdate(notifyListeners?: boolean, isUnmount?: boolean): void
    didUpdate(): void
    measure(removeTransform?: boolean): Measurements
    measurePageBox(): Box
    updateLayout(): void
    updateSnapshot(): void
    clearSnapshot(): void
    updateScroll(phase?: Phase): void
    scheduleUpdateProjection(): void
    scheduleCheckAfterUnmount(): void
    checkUpdateFailed(): void
    sharedNodes: Map<string, NodeStack>
    stacksChanged: number
    registerSharedNode(id: string, node: IProjectionNode): void
    getStack(): NodeStack | undefined
    isVisible: boolean
    hide(): void
    show(): void
    scheduleRender(notifyAll?: boolean): void
    getClosestProjectingParent(): IProjectionNode | undefined

    setTargetDelta(delta: Delta): void
    resetTransform(): void
    resetSkewAndRotation(): void
    applyTransform(
        box: Box,
        transformOnly?: boolean,
        output?: Box,
        skipOwnTransform?: boolean,
        start?: number
    ): Box
    resolveTargetDelta(force?: boolean): void
    removeRelativeTarget(): void
    calcProjection(): void
    applyProjectionStyles(
        targetStyle: CSSStyleDeclaration,
        styleProp?: MotionStyle
    ): void
    clearMeasurements(): void
    resetTree(): void

    isProjecting(): boolean
    /**
     * Whether this node moves as a compositor layer, decided when it
     * starts to move in a layout animation. Undefined when it isn't moving.
     */
    hasLayer?: boolean
    animationValues?: ResolvedValues
    currentAnimation?: AnimationPlaybackControlsWithThen
    /**
     * The latest offsets (px) of the x min, x max, y min and y max edge
     * springs, while a layout animation runs with velocity.
     */
    edgeValues?: number[]
    isTreeAnimating?: boolean
    isAnimationBlocked?: boolean
    setAnimationOrigin(
        delta: Delta,
        hasOnlyRelativeTargetChanged?: boolean,
        pathFn?: MotionPath
    ): void
    startAnimation(transition: ValueTransition): void
    finishAnimation(): void
    hasCheckedOptimisedAppear: boolean

    // Shared element
    isLead(): boolean
    promote(options?: {
        needsReset?: boolean
        transition?: Transition
        preserveFollowOpacity?: boolean
    }): void
    relegate(): boolean
    resumeFrom?: IProjectionNode
    resumingFrom?: IProjectionNode
    isPresent?: boolean

    addEventListener(name: LayoutEvents, handler: any): VoidFunction
    notifyListeners(name: LayoutEvents, ...args: any): void
    hasListeners(name: LayoutEvents): boolean
    hasTreeAnimated: boolean
    preserveOpacity?: boolean
}

export interface LayoutUpdateData {
    layout: Box
    snapshot: Measurements
    delta: Delta
    layoutDelta: Delta
    hasLayoutChanged: boolean
    hasRelativeLayoutChanged: boolean
}

export type LayoutUpdateHandler = (data: LayoutUpdateData) => void

export interface ProjectionNodeConfig<I> {
    defaultParent?: () => IProjectionNode
    attachResizeListener?: (
        instance: I,
        notifyResize: VoidFunction
    ) => VoidFunction
    measureScroll: (instance: I) => Point
    checkIsScrollRoot: (instance: I) => boolean
    resetTransform?: (instance: I, value?: string) => void
}

/**
 * Configuration for initial promotion of shared layout elements.
 * This was originally in React's SwitchLayoutGroupContext but is now
 * framework-agnostic to support vanilla JS usage.
 */
export interface InitialPromotionConfig {
    /**
     * The initial transition to use when the elements in this group mount (and automatically promoted).
     * Subsequent updates should provide a transition in the promote method.
     */
    transition?: Transition
    /**
     * If the follow tree should preserve its opacity when the lead is promoted on mount
     */
    shouldPreserveFollowOpacity?: (member: IProjectionNode) => boolean
}

export interface ProjectionNodeOptions {
    animate?: boolean
    layoutScroll?: boolean
    layoutRoot?: boolean
    alwaysMeasureLayout?: boolean
    onExitComplete?: VoidFunction
    animationType?: "size" | "position" | "both" | "preserve-aspect" | "x" | "y"
    layoutId?: string
    layout?: boolean | string
    visualElement?: VisualElement

    /**
     * `false` disables the opacity crossfade between nodes that share a
     * layoutId. Enabled by default.
     */
    crossfade?: boolean
    transition?: Transition
    initialPromotionConfig?: InitialPromotionConfig
    layoutDependency?: unknown
    layoutAnchor?: Point | false
}

export type ProjectionEventName = "layoutUpdate" | "projectionUpdate"
