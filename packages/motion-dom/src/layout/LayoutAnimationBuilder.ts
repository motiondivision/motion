import type { Box } from "motion-utils"
import { GroupAnimation } from "../animation/GroupAnimation"
import type {
    AnimationOptions,
    AnimationPlaybackControls,
    Transition,
} from "../animation/types"
import { frame } from "../frameloop"
import { copyBoxInto } from "../projection/geometry/copy"
import { createBox } from "../projection/geometry/models"
import { HTMLProjectionNode } from "../projection/node/HTMLProjectionNode"
import type { IProjectionNode } from "../projection/node/types"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { visualElementStore } from "../render/store"
import type { VisualElement } from "../render/VisualElement"
import { resolveElements, type ElementOrSelector } from "../utils/resolve-elements"

type LayoutAnimationScope = Element | Document

interface LayoutElementRecord {
    element: Element
    visualElement: VisualElement
    projection: IProjectionNode
}

interface LayoutAttributes {
    layout?: boolean | "position" | "size" | "preserve-aspect"
    layoutId?: string
}

type LayoutBuilderResolve = (animation: GroupAnimation) => void
type LayoutBuilderReject = (error: unknown) => void

interface ProjectionOptions {
    layout?: boolean | "position" | "size" | "preserve-aspect"
    layoutId?: string
    animationType?: "size" | "position" | "both" | "preserve-aspect"
    transition?: Transition
    crossfade?: boolean
}

const layoutSelector = "[data-layout], [data-layout-id]"
const noop = () => {}
function snapshotFromTarget(projection: IProjectionNode): LayoutElementRecord["projection"]["snapshot"] {
    const target = projection.targetWithTransforms || projection.target
    if (!target) return undefined

    const measuredBox = createBox()
    const layoutBox = createBox()
    copyBoxInto(measuredBox, target as Box)
    copyBoxInto(layoutBox, target as Box)

    return {
        animationId: projection.root?.animationId ?? 0,
        measuredBox,
        layoutBox,
        latestValues: projection.animationValues || projection.latestValues || {},
        source: projection.id,
    }
}

export class LayoutAnimationBuilder {
    private scope: LayoutAnimationScope
    private updateDom: () => void | Promise<void>
    private defaultOptions?: AnimationOptions
    private sharedTransitions = new Map<string, AnimationOptions>()
    private notifyReady: LayoutBuilderResolve = noop
    private rejectReady: LayoutBuilderReject = noop
    private readyPromise: Promise<GroupAnimation>

    constructor(
        scope: LayoutAnimationScope,
        updateDom: () => void | Promise<void>,
        defaultOptions?: AnimationOptions
    ) {
        this.scope = scope
        this.updateDom = updateDom
        this.defaultOptions = defaultOptions

        this.readyPromise = new Promise<GroupAnimation>((resolve, reject) => {
            this.notifyReady = resolve
            this.rejectReady = reject
        })

        frame.postRender(() => {
            this.start().then(this.notifyReady).catch(this.rejectReady)
        })
    }

    shared(id: string, transition: AnimationOptions): this {
        this.sharedTransitions.set(id, transition)
        return this
    }

    then(
        resolve: LayoutBuilderResolve,
        reject?: LayoutBuilderReject
    ): Promise<void> {
        return this.readyPromise.then(resolve, reject)
    }

    private async start(): Promise<GroupAnimation> {
        const beforeElements = collectLayoutElements(this.scope)
        const beforeRecords = this.buildRecords(beforeElements)

        beforeRecords.forEach(({ projection }) => {
            const hasCurrentAnimation = Boolean(projection.currentAnimation)
            const isSharedLayout = Boolean(projection.options.layoutId)
            if (hasCurrentAnimation && isSharedLayout) {
                const snapshot = snapshotFromTarget(projection)
                if (snapshot) {
                    projection.snapshot = snapshot
                } else if (projection.snapshot) {
                    projection.snapshot = undefined
                }
            } else if (
                projection.snapshot &&
                (projection.currentAnimation || projection.isProjecting())
            ) {
                projection.snapshot = undefined
            }
            projection.isPresent = true
            projection.willUpdate()
        })

        await this.updateDom()

        const afterElements = collectLayoutElements(this.scope)
        const afterRecords = this.buildRecords(afterElements)
        this.handleExitingElements(beforeRecords, afterRecords)

        afterRecords.forEach(({ projection }) => {
            const instance = projection.instance as HTMLElement | undefined
            const resumeFromInstance = projection.resumeFrom
                ?.instance as HTMLElement | undefined
            if (!instance || !resumeFromInstance) return
            if (!("style" in instance)) return

            const currentTransform = instance.style.transform
            const resumeFromTransform = resumeFromInstance.style.transform

            if (
                currentTransform &&
                resumeFromTransform &&
                currentTransform === resumeFromTransform
            ) {
                instance.style.transform = ""
                instance.style.transformOrigin = ""
            }
        })

        afterRecords.forEach(({ projection }) => {
            projection.isPresent = true
        })

        const root = getProjectionRoot(afterRecords, beforeRecords)
        root?.didUpdate()

        await new Promise<void>((resolve) => {
            frame.postRender(() => resolve())
        })

        const animations = collectAnimations(afterRecords)
        const animation = new GroupAnimation(animations)

        return animation
    }

    private buildRecords(elements: Element[]): LayoutElementRecord[] {
        const records: LayoutElementRecord[] = []
        const recordMap = new Map<Element, LayoutElementRecord>()

        for (const element of elements) {
            const parentRecord = findParentRecord(element, recordMap, this.scope)
            const { layout, layoutId } = readLayoutAttributes(element)
            const override = layoutId
                ? this.sharedTransitions.get(layoutId)
                : undefined
            const transition = override || this.defaultOptions
            const record = getOrCreateRecord(element, parentRecord?.projection, {
                layout,
                layoutId,
                animationType: typeof layout === "string" ? layout : "both",
                transition: transition as Transition,
            })
            recordMap.set(element, record)
            records.push(record)
        }

        return records
    }

    private handleExitingElements(
        beforeRecords: LayoutElementRecord[],
        afterRecords: LayoutElementRecord[]
    ): void {
        const afterElementsSet = new Set(afterRecords.map((record) => record.element))

        beforeRecords.forEach((record) => {
            if (afterElementsSet.has(record.element)) return

            // For shared layout elements, relegate to set up resumeFrom
            // so the remaining element animates from this position
            if (record.projection.options.layoutId) {
                record.projection.isPresent = false
                record.projection.relegate()
            }

            record.visualElement.unmount()
            visualElementStore.delete(record.element)
        })

        // Clear resumeFrom on EXISTING nodes that point to unmounted projections
        // This prevents crossfade animation when the source element was removed entirely
        // But preserve resumeFrom for NEW nodes so they can animate from the old position
        // Also preserve resumeFrom for lead nodes that were just promoted via relegate
        const beforeElementsSet = new Set(beforeRecords.map((record) => record.element))
        afterRecords.forEach(({ element, projection }) => {
            if (
                beforeElementsSet.has(element) &&
                projection.resumeFrom &&
                !projection.resumeFrom.instance &&
                !projection.isLead()
            ) {
                projection.resumeFrom = undefined
                projection.snapshot = undefined
            }
        })
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
        scope,
        updateDom: updateDomOrOptions as () => void,
        defaultOptions: options,
    }
}

function collectLayoutElements(scope: LayoutAnimationScope): Element[] {
    const elements = Array.from(scope.querySelectorAll(layoutSelector))

    if (scope instanceof Element && scope.matches(layoutSelector)) {
        if (!elements.includes(scope)) {
            elements.unshift(scope)
        }
    }

    return elements
}

function readLayoutAttributes(element: Element): LayoutAttributes {
    const layoutId = element.getAttribute("data-layout-id") || undefined
    const rawLayout = element.getAttribute("data-layout")
    let layout: LayoutAttributes["layout"]

    if (rawLayout === "" || rawLayout === "true") {
        layout = true
    } else if (rawLayout) {
        layout = rawLayout as LayoutAttributes["layout"]
    }

    return {
        layout,
        layoutId,
    }
}

function createVisualState() {
    return {
        latestValues: {},
        renderState: {
            transform: {},
            transformOrigin: {},
            style: {},
            vars: {},
        },
    }
}

function getOrCreateRecord(
    element: Element,
    parentProjection?: IProjectionNode,
    projectionOptions?: ProjectionOptions
): LayoutElementRecord {
    const existing = visualElementStore.get(element) as VisualElement | undefined
    const visualElement =
        existing ??
        new HTMLVisualElement(
            {
                props: {},
                presenceContext: null,
                visualState: createVisualState(),
            },
            { allowProjection: true }
        )

    if (!existing || !visualElement.projection) {
        visualElement.projection = new HTMLProjectionNode(
            visualElement.latestValues,
            parentProjection
        )
    }

    visualElement.projection.setOptions({
        ...projectionOptions,
        visualElement,
    })

    if (!visualElement.current) {
        visualElement.mount(element as HTMLElement)
    } else if (!visualElement.projection.instance) {
        // Mount projection if VisualElement is already mounted but projection isn't
        // This happens when animate() was called before animateLayout()
        visualElement.projection.mount(element as HTMLElement)
    }

    if (!existing) {
        visualElementStore.set(element, visualElement)
    }

    return {
        element,
        visualElement,
        projection: visualElement.projection as IProjectionNode,
    }
}

function findParentRecord(
    element: Element,
    recordMap: Map<Element, LayoutElementRecord>,
    scope: LayoutAnimationScope
) {
    let parent = element.parentElement

    while (parent) {
        const record = recordMap.get(parent)
        if (record) return record

        if (parent === scope) break
        parent = parent.parentElement
    }

    return undefined
}

function getProjectionRoot(
    afterRecords: LayoutElementRecord[],
    beforeRecords: LayoutElementRecord[]
) {
    const record = afterRecords[0] || beforeRecords[0]
    return record?.projection.root
}

function collectAnimations(afterRecords: LayoutElementRecord[]) {
    const animations = new Set<AnimationPlaybackControls>()

    afterRecords.forEach((record) => {
        const animation = record.projection.currentAnimation
        if (animation) animations.add(animation)
    })

    return Array.from(animations)
}
