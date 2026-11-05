import type { JSAnimation } from "../../animation/JSAnimation"
import type {
    MotionPath,
    Transition,
    ValueTransition,
} from "../../animation/types"
import type { ResolvedValues } from "../../render/types"
import type { VisualElement, MotionStyle } from "../../render/VisualElement"
import { Box, Delta, Point } from "motion-utils"
import { FlatTree } from "../utils/flat-tree"
import { NodeStack } from "../shared/stack"
import type { Mat3 } from "../quad/mat3"
import type { Quad } from "../quad/quad"
import type { QuadProjection } from "./quad-projection"

/**
 * The space a node is drawn in, when transforms Motion doesn't control
 * ("layers") lie above it, and (for snapshots that might hand over to
 * another space) the corners it was visible at.
 *
 * A node's boxes are measured inside its layers, so the box engine
 * animates it exactly while it stays in the same space.
 */
export interface QuadMeasurements {
    /**
     * The node's untransformed box on the page.
     */
    rect: Box

    /**
     * Layers between the node's projection parent and the node, as a
     * page-space homography.
     */
    env: Mat3

    /**
     * Every layer above the node, as a page-space homography. A node whose
     * frame changes between snapshot and layout has moved between spaces.
     */
    frame: Mat3

    /**
     * `perspective` on the node's parent: distance (0 if none), then its
     * page origin.
     */
    perspective: Float64Array

    /**
     * Whether a layer distorts the node relative to a tracked projection
     * parent, which the box engine can't correct for.
     */
    isQuadSpace: boolean

    /**
     * For snapshots, the corners the node was visible at.
     */
    visual?: Quad

    /**
     * Restores the layers neutralised while the node's boxes are measured.
     */
    restore?: VoidFunction
}

export interface Measurements {
    animationId: number
    measuredBox: Box
    layoutBox: Box
    latestValues: ResolvedValues
    source: number
    quad?: QuadMeasurements
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
    quad?: QuadProjection
    isSVG?: boolean
    applyTransformsToTarget(): void
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
    getLead(): IProjectionNode
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
    mixShared?: VoidFunction
    animationProgress: number
    mixTargetDelta: (progress: number) => void
    attemptToResolveRelativeTarget?: boolean
    hasProjected: boolean

    /**
     * For nodes whose own transform isn't in `latestValues`, like planes
     * in a 3D scene: write the page-space homography from `rect` onto
     * where the node is laid out now. Returns false if it can't be seen.
     */
    measureTransform?(rect: Box, out: Mat3): boolean
    currentAnimation?: JSAnimation<number>
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
