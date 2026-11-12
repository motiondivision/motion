import type {
    AnimationPlaybackControls,
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
     * velocity is per axis [min edge, max edge, x/y value] in the page.
     * relativeVelocity is per axis [min edge, max edge] inside the
     * parent, for a child that was moving inside an animating parent.
     */
    velocity?: number[][]
    relativeVelocity?: number[][]
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
    id: number
    animationId: number
    animationCommitId: number
    parent?: IProjectionNode
    relativeParent?: IProjectionNode
    root?: IProjectionNode
    children: Set<IProjectionNode>
    path: IProjectionNode[]
    nodes?: FlatTree
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
    needsReset: boolean
    needsShow?: boolean
    startUpdate(): void
    willUpdate(notifyListeners?: boolean): void
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
    animationValues?: ResolvedValues
    currentAnimation?: AnimationPlaybackControls
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
    crossfade?: boolean
    transition?: Transition
    initialPromotionConfig?: InitialPromotionConfig
    layoutDependency?: unknown
    layoutAnchor?: Point | false
}

export type ProjectionEventName = "layoutUpdate" | "projectionUpdate"
