import type { AnimationOptions } from "../animation/types"
import type {
    IProjectionNode,
    ProjectionNodeOptions,
} from "../projection/node/types"
import { HTMLProjectionNode } from "../projection/node/HTMLProjectionNode"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { nodeGroup, type NodeGroup } from "../projection/node/group"
import { getLayoutId } from "./detect-mutations"
import { addScaleCorrector } from "../render/utils/is-forced-motion-value"
import { correctBorderRadius } from "../projection/styles/scale-border-radius"
import { correctBoxShadow } from "../projection/styles/scale-box-shadow"

let scaleCorrectorAdded = false

function ensureScaleCorrectors() {
    if (scaleCorrectorAdded) return
    scaleCorrectorAdded = true

    addScaleCorrector({
        borderRadius: {
            ...correctBorderRadius,
            applyTo: [
                "borderTopLeftRadius",
                "borderTopRightRadius",
                "borderBottomLeftRadius",
                "borderBottomRightRadius",
            ],
        },
        borderTopLeftRadius: correctBorderRadius,
        borderTopRightRadius: correctBorderRadius,
        borderBottomLeftRadius: correctBorderRadius,
        borderBottomRightRadius: correctBorderRadius,
        boxShadow: correctBoxShadow,
    })
}

export interface ProjectionContext {
    nodes: Map<HTMLElement, IProjectionNode>
    visualElements: Map<HTMLElement, HTMLVisualElement>
    group: NodeGroup
    root: IProjectionNode
}

/**
 * Get DOM depth of an element
 */
function getDepth(element: Element): number {
    let depth = 0
    let current = element.parentElement
    while (current) {
        depth++
        current = current.parentElement
    }
    return depth
}

/**
 * Find the closest projection parent for an element
 */
function findProjectionParent(
    element: HTMLElement,
    nodeCache: Map<HTMLElement, IProjectionNode>
): IProjectionNode | undefined {
    let parent = element.parentElement as HTMLElement | null
    while (parent) {
        const node = nodeCache.get(parent)
        if (node) return node
        parent = parent.parentElement as HTMLElement | null
    }
    return undefined
}

/**
 * Create a single projection node for an element
 */
function createProjectionNode(
    element: HTMLElement,
    parent: IProjectionNode | undefined,
    options: ProjectionNodeOptions,
    transition?: AnimationOptions
): { node: IProjectionNode; visualElement: HTMLVisualElement } {
    const latestValues: Record<string, any> = {}

    const visualElement = new HTMLVisualElement({
        visualState: {
            latestValues,
            renderState: {
                transformOrigin: {},
                transform: {},
                style: {},
                vars: {},
            },
        },
        presenceContext: null,
        props: {},
    })

    const node = new HTMLProjectionNode(latestValues, parent)

    // Convert AnimationOptions to transition format for the projection system
    const nodeTransition = transition
        ? { duration: transition.duration, ease: transition.ease as any }
        : { duration: 0.3, ease: "easeOut" }

    node.setOptions({
        visualElement,
        layout: true,
        animate: true,
        transition: nodeTransition,
        ...options,
    })

    node.mount(element)
    visualElement.projection = node

    return { node, visualElement }
}

export interface BuildProjectionTreeOptions {
    defaultTransition?: AnimationOptions
    sharedTransitions?: Map<string, AnimationOptions>
}

/**
 * Build a projection tree from a list of elements
 */
export function buildProjectionTree(
    elements: HTMLElement[],
    existingContext?: ProjectionContext,
    options?: BuildProjectionTreeOptions
): ProjectionContext {
    ensureScaleCorrectors()

    const nodes = existingContext?.nodes ?? new Map<HTMLElement, IProjectionNode>()
    const visualElements =
        existingContext?.visualElements ?? new Map<HTMLElement, HTMLVisualElement>()
    const group = existingContext?.group ?? nodeGroup()

    const defaultTransition = options?.defaultTransition
    const sharedTransitions = options?.sharedTransitions

    // Sort elements by DOM depth (parents before children)
    const sorted = [...elements].sort((a, b) => getDepth(a) - getDepth(b))

    let root: IProjectionNode | undefined = existingContext?.root

    for (const element of sorted) {
        // Skip if already has a node
        if (nodes.has(element)) continue

        const parent = findProjectionParent(element, nodes)
        const layoutId = getLayoutId(element)
        const layoutMode = element.getAttribute("data-layout")

        const nodeOptions: ProjectionNodeOptions = {
            layoutId: layoutId ?? undefined,
            animationType: parseLayoutMode(layoutMode),
        }

        // Use layoutId-specific transition if available, otherwise use default
        const transition = layoutId && sharedTransitions?.get(layoutId)
            ? sharedTransitions.get(layoutId)
            : defaultTransition

        const { node, visualElement } = createProjectionNode(
            element,
            parent,
            nodeOptions,
            transition
        )

        nodes.set(element, node)
        visualElements.set(element, visualElement)
        group.add(node)

        if (!root) {
            root = node.root
        }
    }

    return {
        nodes,
        visualElements,
        group,
        root: root!,
    }
}

/**
 * Parse the data-layout attribute value
 */
function parseLayoutMode(
    value: string | null
): "size" | "position" | "both" | "preserve-aspect" {
    if (value === "position") return "position"
    if (value === "size") return "size"
    if (value === "preserve-aspect") return "preserve-aspect"
    return "both"
}

/**
 * Clean up projection nodes
 */
export function cleanupProjectionTree(context: ProjectionContext) {
    for (const node of context.nodes.values()) {
        context.group.remove(node)
        node.unmount()
    }
    context.nodes.clear()
    context.visualElements.clear()
}

/**
 * Set a value on a projection node's visual element
 */
export function setNodeValue(
    context: ProjectionContext,
    element: HTMLElement,
    key: string,
    value: any
) {
    const visualElement = context.visualElements.get(element)
    if (visualElement) {
        visualElement.latestValues[key] = value
        visualElement.scheduleRender()
    }
}
