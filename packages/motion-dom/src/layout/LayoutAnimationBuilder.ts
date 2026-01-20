import { GroupAnimation } from "../animation/GroupAnimation"
import type {
  AnimationOptions,
  AnimationPlaybackControls,
  Transition,
} from "../animation/types"
import { frame } from "../frameloop"
import { microtask } from "../frameloop/microtask"
import { HTMLProjectionNode } from "../projection/node/HTMLProjectionNode"
import type { IProjectionNode } from "../projection/node/types"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { visualElementStore } from "../render/store"
import type { VisualElement } from "../render/VisualElement"
import { resolveElements, type ElementOrSelector } from "../utils/resolve-elements"

type LayoutAnimationScope = Element | Document

type LayoutElementRecord = {
    element: Element
    visualElement: VisualElement
    projection: IProjectionNode
}

type ExitRecord = LayoutElementRecord & {
    parent: ParentNode | null
    nextSibling: ChildNode | null
}

type LayoutAttributes = {
    layout?: boolean | "position" | "size" | "preserve-aspect"
    layoutId?: string
    layoutExit: boolean
}

type LayoutBuilderResolve = (animation: GroupAnimation) => void
type LayoutBuilderReject = (error: unknown) => void

type ProjectionOptions = {
    layout?: boolean | "position" | "size" | "preserve-aspect"
    layoutId?: string
    animationType?: "size" | "position" | "both" | "preserve-aspect"
    transition?: Transition
    crossfade?: boolean
}

const layoutSelector = "[data-layout], [data-layout-id]"
const noop = () => {}

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

        microtask.read((_frameData) => {
            this.start().then(this.notifyReady).catch(this.rejectReady)
        })
    }

    shared(id: string, transition: AnimationOptions) {
        this.sharedTransitions.set(id, transition)
        return this
    }

    then(resolve: LayoutBuilderResolve, reject?: LayoutBuilderReject) {
        return this.readyPromise.then(resolve, reject)
    }

    private async start(): Promise<GroupAnimation> {
        const beforeElements = collectLayoutElements(this.scope)
        const beforeRecords = this.buildRecords(beforeElements)
        const exitCandidates = collectExitCandidates(beforeRecords)

        beforeRecords.forEach(({ projection }) => {
            projection.isPresent = true
            projection.willUpdate()
        })

        await this.updateDom()

        const afterElements = collectLayoutElements(this.scope)
        const afterRecords = this.buildRecords(afterElements)
        const exitRecords = this.handleExitingElements(
            beforeRecords,
            afterRecords,
            exitCandidates
        )

        afterRecords.forEach(({ projection }) => {
            projection.isPresent = true
        })

        const root = getProjectionRoot(afterRecords, beforeRecords)
        root?.didUpdate()

        await new Promise<void>((resolve) => {
            frame.postRender(() => resolve())
        })

        const animations = collectAnimations(afterRecords, exitRecords)
        const animation = new GroupAnimation(animations)

        if (exitRecords.length) {
            const cleanup = () => {
                exitRecords.forEach(({ element, visualElement }) => {
                    if (element.isConnected) {
                        element.remove()
                    }
                    visualElement.unmount()
                    visualElementStore.delete(element)
                })
            }

            animation.finished.then(cleanup, cleanup)
        }

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
        afterRecords: LayoutElementRecord[],
        exitCandidates: Map<Element, ExitRecord>
    ): LayoutElementRecord[] {
        const afterElementsSet = new Set(afterRecords.map((record) => record.element))
        const exiting: LayoutElementRecord[] = []

        beforeRecords.forEach((record) => {
            if (afterElementsSet.has(record.element)) return

            const exitRecord = exitCandidates.get(record.element)
            if (!exitRecord) {
                record.visualElement.unmount()
                visualElementStore.delete(record.element)
                return
            }

            if (!exitRecord.element.isConnected) {
                reinstateExitElement(exitRecord)
            }

            record.projection.isPresent = false
            if (record.projection.options.layoutId) {
                record.projection.relegate()
            }

            exiting.push(record)
        })

        return exiting
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
        layoutExit: element.hasAttribute("data-layout-exit"),
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

function collectExitCandidates(records: LayoutElementRecord[]) {
    const exitCandidates = new Map<Element, ExitRecord>()

    records.forEach((record) => {
        const { layoutExit } = readLayoutAttributes(record.element)
        if (!layoutExit) return

        exitCandidates.set(record.element, {
            ...record,
            parent: record.element.parentNode,
            nextSibling: record.element.nextSibling,
        })
    })

    return exitCandidates
}

function reinstateExitElement(record: ExitRecord) {
    if (!record.parent) return

    if (record.nextSibling && record.nextSibling.parentNode === record.parent) {
        record.parent.insertBefore(record.element, record.nextSibling)
    } else {
        record.parent.appendChild(record.element)
    }
}

function getProjectionRoot(
    afterRecords: LayoutElementRecord[],
    beforeRecords: LayoutElementRecord[]
) {
    const record = afterRecords[0] || beforeRecords[0]
    return record?.projection.root
}

function collectAnimations(
    afterRecords: LayoutElementRecord[],
    exitRecords: LayoutElementRecord[]
) {
    const animations = new Set<AnimationPlaybackControls>()

    const addAnimation = (record: LayoutElementRecord) => {
        const animation = record.projection.currentAnimation
        if (animation) animations.add(animation)
    }

    afterRecords.forEach(addAnimation)
    exitRecords.forEach(addAnimation)

    return Array.from(animations)
}
