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

function prepareProjectionSnapshot(projection: IProjectionNode): void {
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
}

function resetTransformForResumeFrom(projection: IProjectionNode): void {
    const instance = projection.instance as HTMLElement | undefined
    const resumeFromInstance = projection.resumeFrom?.instance as
        | HTMLElement
        | undefined
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
}

function buildLayoutRecords(
    elements: Element[],
    scope: LayoutAnimationScope,
    {
        defaultOptions,
        sharedTransitions,
        transitionOverrides,
    }: {
        defaultOptions?: AnimationOptions
        sharedTransitions?: Map<string, AnimationOptions>
        transitionOverrides?: Map<Element, AnimationOptions>
    } = {}
): LayoutElementRecord[] {
    const records: LayoutElementRecord[] = []
    const recordMap = new Map<Element, LayoutElementRecord>()

    for (const element of elements) {
        const parentRecord = findParentRecord(element, recordMap, scope)
        const { layout, layoutId } = readLayoutAttributes(element)
        const override =
            transitionOverrides?.get(element) ||
            (layoutId ? sharedTransitions?.get(layoutId) : undefined)
        const transition = override || defaultOptions
        const projectionOptions: ProjectionOptions = {
            layout,
            layoutId,
            animationType: typeof layout === "string" ? layout : "both",
        }
        if (transition) {
            projectionOptions.transition = transition as Transition
        }
        const record = getOrCreateRecord(
            element,
            parentRecord?.projection,
            projectionOptions
        )
        recordMap.set(element, record)
        records.push(record)
    }

    return records
}

function handleExitingElements(
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

function collectElementsFromScopes(
    scopes: Iterable<LayoutAnimationScope>
): Element[] {
    const elements = new Set<Element>()
    for (const scope of scopes) {
        collectLayoutElements(scope).forEach((element) => elements.add(element))
    }
    return sortElementsByDomPosition(Array.from(elements))
}

function sortElementsByDomPosition(elements: Element[]): Element[] {
    return elements.slice().sort((a, b) => {
        if (a === b) return 0
        const position = a.compareDocumentPosition(b)
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
        return 0
    })
}

function isLayoutAnimationScope(
    value: unknown
): value is ElementOrSelector | LayoutAnimationScope {
    if (value == null) return false
    if (typeof value === "string") return true
    if (typeof Document !== "undefined" && value instanceof Document) return true
    if (typeof Element !== "undefined" && value instanceof Element) return true
    if (Array.isArray(value)) return true
    return (
        typeof (value as { length?: unknown }).length === "number" &&
        typeof (value as { item?: unknown }).item === "function"
    )
}

function resolveAddScopes(
    scopeOrOptions?: ElementOrSelector | AnimationOptions
): LayoutAnimationScope[] {
    if (!isLayoutAnimationScope(scopeOrOptions)) {
        return [document]
    }

    if (typeof Document !== "undefined" && scopeOrOptions instanceof Document) {
        return [scopeOrOptions]
    }

    if (typeof Element !== "undefined" && scopeOrOptions instanceof Element) {
        return [scopeOrOptions]
    }

    const elements = resolveElements(scopeOrOptions as ElementOrSelector)
    return elements.length ? elements : [document]
}

function parseLayoutAnimationAddArgs(
    scopeOrOptions?: ElementOrSelector | AnimationOptions,
    options?: AnimationOptions
): {
    scopes: LayoutAnimationScope[]
    options?: AnimationOptions
} {
    if (isLayoutAnimationScope(scopeOrOptions)) {
        return { scopes: resolveAddScopes(scopeOrOptions), options }
    }

    return {
        scopes: [document],
        options: scopeOrOptions as AnimationOptions | undefined,
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
            prepareProjectionSnapshot(projection)
            projection.isPresent = true
            projection.willUpdate()
        })

        await this.updateDom()

        const afterElements = collectLayoutElements(this.scope)
        const afterRecords = this.buildRecords(afterElements)
        handleExitingElements(beforeRecords, afterRecords)

        afterRecords.forEach(({ projection }) => {
            resetTransformForResumeFrom(projection)
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
        return buildLayoutRecords(elements, this.scope, {
            defaultOptions: this.defaultOptions,
            sharedTransitions: this.sharedTransitions,
        })
    }
}

class LayoutAnimationController {
    private scopes = new Set<LayoutAnimationScope>()
    private elements = new Set<Element>()
    private records = new Map<Element, LayoutElementRecord>()
    private beforeRecords: LayoutElementRecord[] = []
    private overrideElements = new Set<Element>()
    private snapshottedElements = new Set<Element>()
    private transitionOverrides = new Map<Element, AnimationOptions>()
    private currentGroup?: GroupAnimation
    private currentGroupPromise?: Promise<GroupAnimation>
    private hasPendingAdd = false

    add(
        scopeOrOptions?: ElementOrSelector | AnimationOptions,
        options?: AnimationOptions
    ): void {
        const { scopes, options: transition } = parseLayoutAnimationAddArgs(
            scopeOrOptions,
            options
        )

        scopes.forEach((scope) => this.scopes.add(scope))

        const elementsInCall = new Set<Element>()
        scopes.forEach((scope) => {
            collectLayoutElements(scope).forEach((element) => {
                elementsInCall.add(element)
                this.elements.add(element)
            })
        })

        if (transition) {
            elementsInCall.forEach((element) => {
                this.transitionOverrides.set(element, transition)
                this.overrideElements.add(element)
            })
        }

        const allElements = sortElementsByDomPosition(
            Array.from(this.elements)
        )
        const records = buildLayoutRecords(allElements, document, {
            transitionOverrides: this.transitionOverrides,
        })
        this.beforeRecords = records
        this.records = new Map(
            records.map((record) => [record.element, record])
        )

        elementsInCall.forEach((element) => {
            if (this.snapshottedElements.has(element)) return
            const record = this.records.get(element)
            if (!record) return
            this.snapshottedElements.add(element)
            prepareProjectionSnapshot(record.projection)
            record.projection.isPresent = true
            record.projection.willUpdate()
        })

        this.hasPendingAdd = true
        this.currentGroup = undefined
        this.currentGroupPromise = undefined
    }

    async play(): Promise<GroupAnimation> {
        if (!this.hasPendingAdd) {
            return this.currentGroup || new GroupAnimation([])
        }

        if (this.currentGroupPromise) {
            return this.currentGroupPromise
        }

        this.currentGroupPromise = this.performPlay()
        const animation = await this.currentGroupPromise
        this.currentGroup = animation
        this.currentGroupPromise = undefined
        return animation
    }

    private async performPlay(): Promise<GroupAnimation> {
        const beforeRecords = this.beforeRecords
        const afterElements = collectElementsFromScopes(this.scopes)
        const afterRecords = buildLayoutRecords(afterElements, document, {
            transitionOverrides: this.transitionOverrides,
        })

        handleExitingElements(beforeRecords, afterRecords)

        afterRecords.forEach(({ projection }) => {
            resetTransformForResumeFrom(projection)
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

        this.clearTransitionOverrides()
        this.resetPendingState()

        return animation
    }

    private clearTransitionOverrides(): void {
        this.overrideElements.forEach((element) => {
            const record = this.records.get(element)
            if (record) {
                record.projection.setOptions({ transition: undefined })
            }
        })

        this.transitionOverrides.clear()
        this.overrideElements.clear()
    }

    private resetPendingState(): void {
        this.scopes.clear()
        this.elements.clear()
        this.records.clear()
        this.beforeRecords = []
        this.snapshottedElements.clear()
        this.hasPendingAdd = false
    }
}

export const layoutAnimation = new LayoutAnimationController()

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
