import { AnimationPlaybackControls } from "motion-dom"
import { InitialPromotionConfig } from "../../context/SwitchLayoutGroupContext"
import { MotionStyle } from "../../motion/types"
import { ResolvedValues } from "../../render/types"
import { FlatTree } from "../../render/utils/flat-tree"
import type { VisualElement } from "../../render/VisualElement"
import { Transition } from "../../types"
import { Box, Delta, Point } from "../geometry/types"
import { NodeStack } from "../shared/stack"

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

export interface IProjectionNode<I = unknown> {
    id: number
    animationId: number
    parent?: IProjectionNode
    relativeParent?: IProjectionNode
    root?: IProjectionNode
    children: Set<IProjectionNode>
    path: IProjectionNode[]
    nodes?: FlatTree
    depth: number
    instance: I
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
    applyTransform(box: Box, transformOnly?: boolean): Box
    resolveTargetDelta(force?: boolean): void
    calcProjection(): void
    getProjectionStyles(styleProp?: MotionStyle): MotionStyle | undefined
    clearMeasurements(): void
    resetTree(): void

    isProjecting(): boolean
    animationValues?: ResolvedValues
    currentAnimation?: AnimationPlaybackControls
    isTreeAnimating?: boolean
    isAnimationBlocked?: boolean
    isTreeAnimationBlocked: () => boolean
    setAnimationOrigin(delta: Delta): void
    startAnimation(transition: Transition): void
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

export interface ProjectionNodeOptions {
    animate?: boolean
    layoutScroll?: boolean
    layoutRoot?: boolean
    alwaysMeasureLayout?: boolean
    onExitComplete?: VoidFunction
    animationType?: "size" | "position" | "both" | "preserve-aspect"
    layoutId?: string
    layout?: boolean | string
    visualElement?: VisualElement
    crossfade?: boolean
    transition?: Transition
    initialPromotionConfig?: InitialPromotionConfig
}

export type ProjectionEventName = "layoutUpdate" | "projectionUpdate"
