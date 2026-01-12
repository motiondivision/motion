import { resolveElements } from "../utils/resolve-elements"
import type { IProjectionNode } from "../projection/node/types"
import type {
    AnimationPlaybackControls,
    DOMKeyframesDefinition,
    Transition,
} from "../animation/types"
import { GroupAnimation } from "../animation/GroupAnimation"
import { NativeAnimationWrapper } from "../animation/NativeAnimationWrapper"
import { frame } from "../frameloop"
import type {
    AnimateLayoutOptions,
    ElementOrSelector,
    EnterExitConfig,
    LayoutAnimationBuilder,
    LayoutNodeFactory,
} from "./types"
import {
    observeMutation,
    findCommonAncestor,
    preserveElementForExit,
} from "./mutation-observer"

/**
 * Default transition for layout animations
 */
const defaultTransition: Transition = {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1], // ease-out cubic
}

/**
 * Global factory for creating projection nodes and visual elements.
 * This must be set by the consuming package (e.g., framer-motion).
 */
let globalFactory: LayoutNodeFactory | null = null

/**
 * Set the global factory for creating layout nodes.
 * This should be called by framer-motion to provide concrete implementations.
 */
export function setLayoutNodeFactory(factory: LayoutNodeFactory): void {
    globalFactory = factory
}

/**
 * Get the current layout node factory
 */
export function getLayoutNodeFactory(): LayoutNodeFactory | null {
    return globalFactory
}

/**
 * Internal node cache for tracking elements across animations
 */
const nodeCache = new WeakMap<Element, IProjectionNode>()

/**
 * Create or retrieve a projection node for an element
 */
function getOrCreateNode(
    element: HTMLElement,
    parent: IProjectionNode | undefined,
    options: AnimateLayoutOptions,
    factory: LayoutNodeFactory
): IProjectionNode {
    let node = nodeCache.get(element)

    if (!node) {
        node = factory.createProjectionNode(element, parent, options)
        nodeCache.set(element, node)
    }

    return node
}

/**
 * Build a projection tree from a list of elements.
 * Parents are determined by DOM ancestry.
 */
function buildProjectionTree(
    elements: Element[],
    options: AnimateLayoutOptions,
    factory: LayoutNodeFactory
): IProjectionNode[] {
    // Sort by DOM depth (parents first)
    const sorted = [...elements].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )

    const nodes: IProjectionNode[] = []
    const elementToNode = new Map<Element, IProjectionNode>()

    for (const element of sorted) {
        if (!(element instanceof HTMLElement)) continue

        // Find parent node from previously processed elements
        let parent: IProjectionNode | undefined
        let ancestor = element.parentElement

        while (ancestor) {
            const ancestorNode = elementToNode.get(ancestor)
            if (ancestorNode) {
                parent = ancestorNode
                break
            }
            ancestor = ancestor.parentElement
        }

        const node = getOrCreateNode(element, parent, options, factory)
        nodes.push(node)
        elementToNode.set(element, node)
    }

    return nodes
}

/**
 * Apply enter animation to an element and return the animation controller
 */
function applyEnterAnimation(
    element: HTMLElement,
    config: EnterExitConfig,
    defaultDuration: number
): AnimationPlaybackControls {
    const { keyframes, transition } = config
    const duration = transition?.duration ?? defaultDuration

    // Get the animation values from keyframes
    // Enter animations typically start from the keyframes values and animate to natural state
    const entries = Object.entries(keyframes)
    const fromValues: Record<string, unknown> = {}
    const toValues: Record<string, unknown> = {}

    for (const [key, value] of entries) {
        if (Array.isArray(value)) {
            // Multi-value keyframe - use first as start, last as end
            fromValues[key] = value[0]
            toValues[key] = value[value.length - 1]
        } else {
            // Single value - use as target, current as start
            toValues[key] = value
        }
    }

    // Set initial state
    for (const [key, value] of Object.entries(fromValues)) {
        if (key in element.style) {
            ;(element.style as unknown as Record<string, unknown>)[key] = value
        }
    }

    // Animate to final state using WAAPI
    const animation = element.animate(
        [fromValues as Keyframe, toValues as Keyframe],
        {
            duration: duration * 1000,
            easing:
                typeof transition?.ease === "string"
                    ? transition.ease
                    : "ease-out",
            fill: "forwards",
        }
    )

    // Commit styles when animation finishes
    if (animation.finished) {
        animation.finished.then(() => {
            animation.commitStyles()
            animation.cancel()
        })
    }

    return new NativeAnimationWrapper(animation)
}

/**
 * Apply exit animation to an element and return the animation controller
 */
function applyExitAnimation(
    element: HTMLElement,
    bounds: DOMRect,
    config: EnterExitConfig,
    defaultDuration: number,
    container: Element
): AnimationPlaybackControls {
    const { keyframes, transition } = config
    const duration = transition?.duration ?? defaultDuration

    // Preserve element in DOM for animation using pre-captured bounds
    const { clone, cleanup } = preserveElementForExit(element, bounds, container)

    // Animate to exit state
    const animation = clone.animate([{}, keyframes as Keyframe], {
        duration: duration * 1000,
        easing:
            typeof transition?.ease === "string" ? transition.ease : "ease-out",
        fill: "forwards",
    })

    // Cleanup when animation finishes
    animation.finished.then(cleanup)

    return new NativeAnimationWrapper(animation)
}

/**
 * Wait for the next animation frame
 */
function nextFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

/**
 * Execute layout animation on the given nodes and return a GroupAnimation
 */
async function executeLayoutAnimation(
    nodes: IProjectionNode[],
    mutation: (() => void) | undefined,
    options: AnimateLayoutOptions,
    enterConfig?: EnterExitConfig,
    exitConfig?: EnterExitConfig
): Promise<GroupAnimation> {
    const animations: AnimationPlaybackControls[] = []

    if (nodes.length === 0 && !mutation) {
        return new GroupAnimation(animations)
    }

    // 1. Snapshot phase - capture current positions
    nodes.forEach((node) => node.willUpdate())

    // Get container for mutation observation
    const elements = nodes
        .map((n) => n.instance)
        .filter((e): e is Element => e !== undefined)
    const container = findCommonAncestor(elements)

    // 2. Execute DOM mutation while observing for changes
    let addedElements: HTMLElement[] = []
    let removedElements: Array<{ element: HTMLElement; bounds: DOMRect }> = []

    if (mutation) {
        const result = observeMutation(container, mutation)
        addedElements = result.addedElements
        removedElements = result.removedElements
    }

    // 3. Trigger layout update and animation
    const root = nodes[0]?.root
    if (root) {
        root.didUpdate()
    }

    // 4. Wait for next frame - animations are created in frame.update()
    await nextFrame()

    // 5. Collect all animations from projection nodes
    for (const node of nodes) {
        if (node.currentAnimation) {
            animations.push(node.currentAnimation)
        }
    }

    // 6. Handle enter animations for newly added elements
    if (enterConfig && addedElements.length > 0) {
        for (const el of addedElements) {
            const anim = applyEnterAnimation(
                el,
                enterConfig,
                options.duration ?? 0.3
            )
            animations.push(anim)
        }
    }

    // 7. Handle exit animations for removed elements
    if (exitConfig && removedElements.length > 0) {
        for (const { element, bounds } of removedElements) {
            const anim = applyExitAnimation(
                element,
                bounds,
                exitConfig,
                options.duration ?? 0.3,
                container
            )
            animations.push(anim)
        }
    }

    return new GroupAnimation(animations)
}

/**
 * Selectors for elements that participate in layout animations
 */
const LAYOUT_SELECTORS = "[data-layout], [data-layout-id]"

/**
 * Check if a value is a valid element or selector
 */
function isElementOrSelector(
    value: unknown
): value is ElementOrSelector {
    return (
        value instanceof Element ||
        typeof value === "string" ||
        (Array.isArray(value) && value.length > 0 && value[0] instanceof Element) ||
        value instanceof NodeList
    )
}

/**
 * Animate layout changes for elements with data-layout or data-layout-id attributes.
 * Returns a builder that resolves to a GroupAnimation implementing AnimationPlaybackControls.
 *
 * When a selector/element is provided, it acts as a **scope** - layout elements
 * (those with data-layout or data-layout-id) are searched within that scope.
 *
 * @example
 * // Document-wide layout animation (all data-layout elements in document)
 * const animation = await animateLayout(() => {
 *     updateDOM()
 * }, { duration: 0.3 })
 *
 * @example
 * // Scoped layout animation - finds data-layout elements within .container
 * const animation = await animateLayout(".container", () => {
 *     // Toggle classes, the underline with data-layout-id will animate
 *     oldTab.classList.remove("selected")
 *     newTab.classList.add("selected")
 * }, { duration: 0.3 })
 *
 * @example
 * // Builder pattern with enter/exit animations
 * const animation = await animateLayout(".cards-container", { duration: 0.3 })
 *     .enter({ opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.2 })
 *     .exit({ opacity: 0, scale: 0.8 }, { duration: 0.15 })
 * animation.time = 0 // Seek to start
 *
 * @example
 * // Scope to specific element
 * const animation = await animateLayout(containerElement, () => {
 *     containerElement.querySelector('.item').style.width = "500px"
 * })
 */
export function animateLayout(
    elementOrSelectorOrMutation?: ElementOrSelector | (() => void) | AnimateLayoutOptions,
    mutationOrOptions?: (() => void) | AnimateLayoutOptions,
    options?: AnimateLayoutOptions
): LayoutAnimationBuilder {
    // Check if factory is configured
    if (!globalFactory) {
        throw new Error(
            "animateLayout: No layout node factory configured. " +
                "Make sure to import from 'framer-motion' or call setLayoutNodeFactory() first."
        )
    }

    const factory = globalFactory

    // Parse overloaded arguments to support:
    // animateLayout(mutation, options) - document-wide
    // animateLayout(options) - document-wide
    // animateLayout(selector, mutation, options) - scoped
    // animateLayout(selector, options) - scoped
    let elements: Element[]
    let mutation: (() => void) | undefined
    let opts: AnimateLayoutOptions

    if (!elementOrSelectorOrMutation || !isElementOrSelector(elementOrSelectorOrMutation)) {
        // No selector provided - scope to entire document
        elements = Array.from(document.querySelectorAll(LAYOUT_SELECTORS))

        if (typeof elementOrSelectorOrMutation === "function") {
            // animateLayout(mutation, options)
            mutation = elementOrSelectorOrMutation
            opts = (mutationOrOptions as AnimateLayoutOptions) ?? {}
        } else {
            // animateLayout(options) or animateLayout()
            mutation = typeof mutationOrOptions === "function" ? mutationOrOptions : undefined
            opts = (elementOrSelectorOrMutation as AnimateLayoutOptions) ??
                   (typeof mutationOrOptions === "object" ? mutationOrOptions : {})
        }
    } else {
        // Selector provided - use as scope for finding layout elements
        const scopeElements = resolveElements(elementOrSelectorOrMutation)
        elements = []

        for (const scope of scopeElements) {
            // Find layout elements within this scope
            const layoutElements = scope.querySelectorAll(LAYOUT_SELECTORS)
            elements.push(...Array.from(layoutElements))

            // Also include the scope element itself if it has layout attributes
            if (scope.matches(LAYOUT_SELECTORS)) {
                elements.push(scope)
            }
        }

        // Remove duplicates (in case nested scopes)
        elements = [...new Set(elements)]

        mutation = typeof mutationOrOptions === "function" ? mutationOrOptions : undefined
        opts = typeof mutationOrOptions === "object"
            ? mutationOrOptions
            : options ?? {}
    }

    // Merge with default transition
    const mergedOptions: AnimateLayoutOptions = {
        ...opts,
        transition: {
            ...defaultTransition,
            ...opts.transition,
            duration: opts.duration ?? opts.transition?.duration ?? 0.3,
            ease: opts.ease ?? opts.transition?.ease,
        },
    }

    // Build projection tree
    const nodes = buildProjectionTree(elements, mergedOptions, factory)

    // State for builder pattern
    let enterConfig: EnterExitConfig | undefined
    let exitConfig: EnterExitConfig | undefined
    let animationPromise: Promise<GroupAnimation> | undefined

    const builder: LayoutAnimationBuilder = {
        enter(
            keyframes: DOMKeyframesDefinition,
            transition?: Transition
        ): LayoutAnimationBuilder {
            enterConfig = { keyframes, transition }
            return builder
        },

        exit(
            keyframes: DOMKeyframesDefinition,
            transition?: Transition
        ): LayoutAnimationBuilder {
            exitConfig = { keyframes, transition }
            return builder
        },

        then<T>(
            onResolve: (value: GroupAnimation) => T,
            onReject?: (err: Error) => void
        ): Promise<T> {
            // Execute animation if not already started
            if (!animationPromise) {
                animationPromise = executeLayoutAnimation(
                    nodes,
                    mutation,
                    mergedOptions,
                    enterConfig,
                    exitConfig
                )
            }

            return animationPromise
                .then((groupAnimation) => onResolve(groupAnimation))
                .catch((err) => {
                    if (onReject) onReject(err)
                    throw err
                })
        },
    }

    // If mutation is provided, schedule execution on microtask
    // to allow builder methods to be called first
    if (mutation) {
        queueMicrotask(() => {
            if (!animationPromise) {
                animationPromise = executeLayoutAnimation(
                    nodes,
                    mutation,
                    mergedOptions,
                    enterConfig,
                    exitConfig
                )
            }
        })
    }

    return builder
}
