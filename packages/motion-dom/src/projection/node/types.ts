import type { Transition, ValueTransition } from "../../animation/types"
import type { JSAnimation } from "../../animation/JSAnimation"
import { Box, Delta, Point } from "motion-utils"
import { ResolvedValues } from "../../render/types"

export interface Measurements {
    animationId: number
    measuredBox: Box
    layoutBox: Box
    latestValues: ResolvedValues
    source: number
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

/**
 * Configuration for initial promotion of shared layout elements.
 * This is used when elements mount and need an initial transition.
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
    animationType?: "size" | "position" | "both" | "preserve-aspect"
    layoutId?: string
    layout?: boolean | string
    visualElement?: VisualElementLike
    crossfade?: boolean
    transition?: Transition
    initialPromotionConfig?: InitialPromotionConfig
    scheduleRender?: VoidFunction
}

/**
 * Minimal VisualElement interface needed for projection.
 * The full VisualElement will be moved to motion-dom in Phase 2.
 */
export interface VisualElementLike {
    props: {
        style?: { display?: string; [key: string]: unknown }
        [key: string]: unknown
    }
    projection?: IProjectionNode
    getInstance?(): Element | undefined
    scheduleRender?(force?: boolean): void
    animationState?: {
        animateChanges: (options?: unknown, type?: unknown) => Promise<unknown>
    }
    getValue?(key: string): { get(): unknown; set(v: unknown): void } | undefined
    readValue?(key: string): unknown
    setStaticValue?(key: string, value: unknown): void
    getStaticValue?(key: string): unknown
    latestValues?: ResolvedValues
}

/**
 * FlatTree is a sorted collection of nodes by depth.
 * Simplified interface - full implementation in render/utils/flat-tree.ts
 */
export interface FlatTreeLike {
    add(child: { depth: number }): void
    remove(child: { depth: number }): void
    forEach(callback: (child: { depth: number }) => void): void
}

/**
 * NodeStack manages lead/follow relationships for shared layout elements.
 * Simplified interface - full implementation in projection/shared/stack.ts
 */
export interface NodeStackLike {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[]
    add(node: IProjectionNode): void
    remove(node: IProjectionNode): void
    relegate(node: IProjectionNode): boolean
    promote(node: IProjectionNode, preserveFollowOpacity?: boolean): void
    exitAnimationComplete(): void
    scheduleRender(): void
    removeLeadSnapshot(): void
}

export interface IProjectionNode<I = unknown> {
    linkedParentVersion: number
    layoutVersion: number
    id: number
    animationId: number
    animationCommitId: number
    parent?: IProjectionNode
    relativeParent?: IProjectionNode
    root?: IProjectionNode
    children: Set<IProjectionNode>
    path: IProjectionNode[]
    nodes?: FlatTreeLike
    depth: number
    instance: I | undefined
    mount: (node: I, isLayoutDirty?: boolean) => void
    unmount: () => void
    options: ProjectionNodeOptions
    setOptions(options: ProjectionNodeOptions): void
    layout?: Measurements
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
    sharedNodes: Map<string, NodeStackLike>
    registerSharedNode(id: string, node: IProjectionNode): void
    getStack(): NodeStackLike | undefined
    isVisible: boolean
    hide(): void
    show(): void
    scheduleRender(notifyAll?: boolean): void
    getClosestProjectingParent(): IProjectionNode | undefined

    setTargetDelta(delta: Delta): void
    resetTransform(): void
    resetSkewAndRotation(): void
    applyTransform(box: Box, transformOnly?: boolean): Box
    resolveTargetDelta(force?: boolean): void
    calcProjection(): void
    clearMeasurements(): void
    resetTree(): void

    isProjecting(): boolean
    animationValues?: ResolvedValues
    currentAnimation?: JSAnimation<number>
    isTreeAnimating?: boolean
    isAnimationBlocked?: boolean
    isTreeAnimationBlocked: () => boolean
    setAnimationOrigin(delta: Delta): void
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

    addEventListener(name: LayoutEvents, handler: unknown): VoidFunction
    notifyListeners(name: LayoutEvents, ...args: unknown[]): void
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

export type ProjectionEventName = "layoutUpdate" | "projectionUpdate"
