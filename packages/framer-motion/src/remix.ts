import {
    acquireProjectionNode,
    animateLayout,
    buildHTMLStyles,
    buildSVGAttrs,
    flushLayoutSnapshots,
    frame,
    HTMLVisualElement,
    isControllingVariants,
    isForcedMotionValue,
    isMotionValue,
    isSVGTag,
    isVariantNode,
    resolveMotionValue,
    resolveVariantFromProps,
    scopeMotion as createScope,
    scrapeHTMLMotionValuesFromProps,
    scrapeSVGMotionValuesFromProps,
    SVGVisualElement,
    visualElementStore,
    type LayoutAnimationBuilder,
    type MotionNodeOptions,
    type MotionScope,
    type MotionValue,
    type PresenceContextProps,
    type ReducedMotionConfig,
    type ResolvedValues,
    type ScopeOptions,
    type ScopeSetup,
    type Transition,
    type VariantLabels,
} from "motion-dom"
import { createElement, createMixin } from "remix/component"
import type { Handle, RemixNode } from "remix/component"
import { DragGesture } from "./gestures/drag"
import { PanGesture } from "./gestures/pan"
import { animations } from "./motion/features/animations"
import { gestureAnimations } from "./motion/features/gestures"
import { loadFeatures } from "./motion/features/load-features"
import { isValidMotionProp } from "./motion/utils/valid-prop"
import { lowercaseSVGElements } from "./render/svg/lowercase-elements"
import { createReorder } from "./remix-reorder"

type Values = Record<string, any>

export type MotionStyle = Record<
    string,
    string | number | MotionValue | undefined
>

/**
 * The same props as React's `<motion.div>`, without React's DOM props.
 */
export interface MotionProps extends MotionNodeOptions {
    style?: MotionStyle
}

export interface MotionConfigProps {
    transition?: Transition
    reducedMotion?: ReducedMotionConfig
    children?: RemixNode
}

export interface AnimatePresenceProps {
    /**
     * Set to `false` to skip the `initial` animation of the motion elements
     * rendered with `AnimatePresence`'s first render.
     */
    initial?: boolean

    /**
     * - `"sync"`: Elements enter and exit at the same time.
     * - `"wait"`: New elements render after the exiting elements are removed.
     * - `"popLayout"`: Exiting elements are taken out of the layout with
     *   `position: absolute`, so the elements around them can move at once.
     */
    mode?: "sync" | "wait" | "popLayout"

    /**
     * In "popLayout" mode, the side exiting elements stay pinned to.
     *
     * @default "left"
     */
    anchorX?: "left" | "right"

    /**
     * In "popLayout" mode, the side exiting elements stay pinned to.
     *
     * @default "top"
     */
    anchorY?: "top" | "bottom"

    /**
     * A value that replaces `custom` on exiting elements, to resolve
     * dynamic `exit` variants with the latest data.
     */
    custom?: any

    /**
     * Called when every exiting element is removed.
     */
    onExitComplete?: VoidFunction

    children?: RemixNode
}

export interface LayoutGroupProps {
    /**
     * Prefixes every `layoutId` inside, so separate groups can use the
     * same `layoutId`s without animating between each other.
     */
    id?: string
    children?: RemixNode
}

interface VariantContext {
    initial?: false | VariantLabels
    animate?: VariantLabels
}

interface PresenceGroup {
    props: AnimatePresenceProps
    isFirstRender: boolean
}

let featuresLoaded = false

function loadRemixFeatures() {
    if (featuresLoaded) return
    featuresLoaded = true
    loadFeatures({
        ...animations,
        ...gestureAnimations,
        pan: { Feature: PanGesture },
        drag: { Feature: DragGesture },
    })
}

/**
 * Set a default `transition` and `reducedMotion` for every motion element
 * below it.
 *
 * @public
 */
export function MotionConfig(
    handle: Handle<MotionConfigProps, MotionConfigProps>
) {
    return () => {
        const { children, ...config } = handle.props
        handle.context.set({
            ...(handle.context.get(MotionConfig) as MotionConfigProps),
            ...config,
        })
        return children
    }
}

const flatten = (node: RemixNode): any[] =>
    Array.isArray(node) ? (node as any[]).flat(Infinity) : [node]

/**
 * A motion component is a component, so Remix can't see the key of the
 * element it renders. Pass the key to the element, so Remix keeps the
 * element when the component is reordered.
 */
const withPresenceKey = (child: any) =>
    child?.key != null && motionComponents.has(child.type)
        ? { ...child, props: { ...child.props, presenceKey: child.key } }
        : child

/**
 * What a child of `AnimatePresence` tells the motion elements inside it.
 */
interface PresenceChildContext {
    isPresent: boolean
    custom?: any
    /**
     * Exits registered while the child exits. It's removed when they finish.
     */
    exits: Promise<void>[]
    /**
     * In "popLayout" mode, whether an element has left the layout yet.
     */
    popLayout?: boolean
    popped?: boolean
    anchorX?: "left" | "right"
    anchorY?: "top" | "bottom"
}

interface PresenceChildProps {
    isPresent: boolean
    custom?: any
    popLayout?: boolean
    anchorX?: "left" | "right"
    anchorY?: "top" | "bottom"
    onExitComplete: VoidFunction
    children?: RemixNode
}

/**
 * Keeps an exiting child of `AnimatePresence` until the exits of the
 * motion elements inside it finish, as React's PresenceChild.
 */
function PresenceChild(
    handle: Handle<PresenceChildProps, PresenceChildContext>
) {
    let exitId = 0
    let popped = false
    let exits: Promise<void>[] = []

    return () => {
        const { isPresent, children } = handle.props
        if (isPresent) exits = []
        const context: PresenceChildContext = {
            ...handle.props,
            exits,
            popped,
        }
        handle.context.set(context)

        /**
         * Every exit registered since the child started exiting, checked
         * by the latest render only.
         */
        const id = ++exitId
        if (isPresent) {
            popped = false
        } else {
            handle.queueTask(() => {
                popped ||= !!context.popped
                Promise.all([...exits]).then(() => {
                    if (id === exitId) handle.props.onExitComplete()
                })
            })
        }

        return children
    }
}

interface PresenceItem {
    key: any
    child: any
    isPresent: boolean
}

const getKey = (child: any, index: number) => child?.key ?? "__i" + index

/**
 * Keep removed children of `AnimatePresence` until their motion elements
 * finish their `exit` animations. Also choose how entering and exiting
 * children share the screen, skip their first `initial` animation, and
 * know when exits finish.
 *
 * @public
 */
export function AnimatePresence(
    handle: Handle<AnimatePresenceProps, PresenceGroup>
) {
    let items: PresenceItem[] = []
    const exited = new Set<any>()

    const group: PresenceGroup = {
        props: handle.props,
        isFirstRender: true,
    }

    const remove = (key: any) => {
        exited.add(key)
        handle.update()
    }

    return () => {
        handle.context.set(group)
        if (group.isFirstRender) {
            handle.queueTask(() => (group.isFirstRender = false))
        }

        const { mode, custom } = handle.props
        const present = flatten(handle.props.children).filter(
            (child) => child != null && child !== false && child !== true
        )
        const presentKeys = new Map(
            present.map((child, i) => [getKey(child, i), child])
        )

        /**
         * Merge the present children with the exiting ones, which keep
         * their place.
         */
        const next: PresenceItem[] = present.map((child, i) => ({
            key: getKey(child, i),
            child,
            isPresent: true,
        }))
        items.forEach((item, i) => {
            if (presentKeys.has(item.key) || exited.has(item.key)) return
            next.splice(Math.min(i, next.length), 0, {
                ...item,
                isPresent: false,
            })
        })

        const hadExited = exited.size > 0
        exited.clear()
        items = next

        /**
         * Once every exit finishes. Not when an exiting child comes back.
         */
        const isExiting = next.some((item) => !item.isPresent)
        if (hadExited && !isExiting) {
            handle.queueTask(() => handle.props.onExitComplete?.())
        }

        /**
         * In "wait" mode, render the new children once the old ones
         * have exited.
         */
        const shown =
            mode === "wait" && isExiting
                ? next.filter((item) => !item.isPresent)
                : next

        return shown.map(({ key, child, isPresent }) =>
            createElement(
                PresenceChild,
                {
                    key,
                    isPresent,
                    custom,
                    popLayout: mode === "popLayout",
                    anchorX: handle.props.anchorX,
                    anchorY: handle.props.anchorY,
                    onExitComplete: () => remove(key),
                },
                withPresenceKey(child)
            )
        )
    }
}

/**
 * Inside `AnimatePresence`: keep the exiting child until `exit` resolves,
 * like React's `safeToRemove`. Call it in each render while `isPresent()`
 * is `false`.
 *
 * @public
 */
export function holdPresence(handle: Handle<any, any>, exit: Promise<void>) {
    const context = handle.context.get(PresenceChild) as
        | PresenceChildContext
        | undefined
    context && !context.isPresent && context.exits.push(exit)
}

/**
 * Inside `AnimatePresence`: whether the component is present, or exiting.
 *
 * @public
 */
export function isPresent(handle: Handle<any, any>) {
    const context = handle.context.get(PresenceChild) as
        | PresenceChildContext
        | undefined
    return context?.isPresent ?? true
}

/**
 * Inside `AnimatePresence`: the `custom` value of `AnimatePresence`, while
 * the component exits.
 *
 * @public
 */
export function getPresenceData(handle: Handle<any, any>) {
    return (
        handle.context.get(PresenceChild) as PresenceChildContext | undefined
    )?.custom
}

/**
 * Give the `layoutId`s inside an `id`, so separate groups don't animate
 * between each other.
 *
 * @public
 */
export function LayoutGroup(
    handle: Handle<LayoutGroupProps, LayoutGroupProps>
) {
    return () => {
        const parent = (handle.context.get(LayoutGroup) as LayoutGroupProps)?.id
        const { id } = handle.props
        handle.context.set({
            id: parent && id ? parent + "-" + id : id || parent,
        })
        return handle.props.children
    }
}

/**
 * Passes variant labels from a motion component to the motion components
 * inside it, so their server render starts in the inherited variant.
 */
function VariantProvider(
    handle: Handle<
        { value: VariantContext; children?: RemixNode },
        VariantContext
    >
) {
    return () => {
        handle.context.set(handle.props.value)
        return handle.props.children
    }
}

const isLabels = (value: unknown): value is VariantLabels =>
    typeof value === "string" || Array.isArray(value)

function getVariantContext(
    props: MotionProps,
    parent?: VariantContext
): VariantContext | undefined {
    if (!isControllingVariants(props as any)) {
        return props.inherit === false ? undefined : parent
    }
    return {
        initial:
            props.initial === false || isLabels(props.initial)
                ? props.initial
                : undefined,
        animate: isLabels(props.animate) ? props.animate : undefined,
    }
}

const isSVGElement = (tag: string) =>
    !tag.includes("-") &&
    (lowercaseSVGElements.includes(tag) || /[A-Z]/u.test(tag))

/**
 * The values a motion element renders before it animates, as React's
 * `makeLatestValues`.
 */
function makeLatestValues(
    props: MotionProps,
    context: VariantContext | undefined,
    isSVG: boolean,
    isInitialBlocked?: boolean
) {
    const values: ResolvedValues = {}

    const motionValues = (
        isSVG ? scrapeSVGMotionValuesFromProps : scrapeHTMLMotionValuesFromProps
    )(props as any, {}, undefined as any)
    for (const key in motionValues) {
        values[key] = resolveMotionValue(motionValues[key])
    }

    let { initial, animate } = props
    if (
        context &&
        isVariantNode(props as any) &&
        !isControllingVariants(props as any) &&
        props.inherit !== false
    ) {
        if (initial === undefined) initial = context.initial
        if (animate === undefined) animate = context.animate
    }

    const isBlocked = isInitialBlocked || initial === false
    const toSet = isBlocked ? animate : initial
    if (!toSet || typeof toSet === "boolean") return values

    for (const definition of Array.isArray(toSet) ? toSet : [toSet]) {
        const resolved = resolveVariantFromProps(props as any, definition)
        if (!resolved) continue

        const { transitionEnd, transition, ...target } = resolved as Values
        for (const key in target) {
            let value = target[key]
            if (Array.isArray(value)) {
                value = value[isBlocked ? value.length - 1 : 0]
            }
            if (value !== null) values[key] = value
        }
        Object.assign(values, transitionEnd)
    }

    return values
}

/**
 * Split `style` into what Remix renders and what Motion owns: motion
 * values and transforms like `x`, which the VisualElement renders.
 */
function splitStyle(style: MotionStyle | undefined, props: MotionProps) {
    const css: Values = {}
    for (const key in style) {
        const value = style[key]
        if (!isMotionValue(value) && !isForcedMotionValue(key, props as any)) {
            css[key] = value
        }
    }
    return css
}

const createRenderState = () => ({
    style: {},
    vars: {},
    transform: {},
    transformOrigin: {},
    attrs: {},
})

/**
 * The style, and attributes for SVG, that render `latestValues`.
 */
function renderValues(
    latestValues: ResolvedValues,
    props: MotionProps,
    tag: string,
    isSVG: boolean
): Values {
    const state = createRenderState()
    if (isSVG) {
        buildSVGAttrs(
            state,
            latestValues,
            isSVGTag(tag),
            props.transformTemplate,
            props.style
        )
    } else {
        buildHTMLStyles(state, latestValues, props.transformTemplate)
    }
    return { ...state.attrs, style: { ...state.vars, ...state.style } }
}

/**
 * Run each callback even if an earlier one throws, and report the error.
 */
const run = (callback: VoidFunction) => {
    try {
        callback()
    } catch (error) {
        queueMicrotask(() => {
            throw error
        })
    }
}

/**
 * Elements inserted in one commit are mounted together on the next
 * microtask, so every parent exists before its children look it up.
 * Remix inserts children before their parents.
 */
let insertQueue:
    | Array<[create: VoidFunction, mount: VoidFunction, animate: VoidFunction]>
    | undefined

function queueInsert(
    create: VoidFunction,
    mount: VoidFunction,
    animate: VoidFunction
) {
    if (!insertQueue) {
        insertQueue = []
        queueMicrotask(flushInserts)
    }
    insertQueue.push([create, mount, animate])
}

/**
 * Mount the elements inserted in this commit. Also runs before a layout
 * snapshot, in case they update again before the microtask.
 */
function flushInserts() {
    const queue = insertQueue
    if (!queue) return
    insertQueue = undefined

    // Parents first, so children join their variant tree...
    for (let i = queue.length - 1; i >= 0; i--) run(queue[i][0])
    for (let i = queue.length - 1; i >= 0; i--) run(queue[i][1])
    // ...and children animate first, as with React's effects.
    for (const [, , animate] of queue) run(animate)
}

/**
 * Updates queued in one commit: every element gets its new props before
 * any of them animates, as React's insertion effects run before its
 * effects. So a variant change from a parent animates its children with
 * their new transitions.
 */
let updateQueue: Array<[update: VoidFunction, animate: VoidFunction]> | undefined

function queueUpdate(update: VoidFunction, animate: VoidFunction) {
    if (!updateQueue) {
        updateQueue = []
        queueMicrotask(() => {
            const queue = updateQueue!
            updateQueue = undefined
            for (const [update] of queue) run(update)
            // Parents render first, so animate in reverse: children first.
            for (let i = queue.length - 1; i >= 0; i--) run(queue[i][1])
        })
    }
    updateQueue.push([update, animate])
}

type AnyVisualElement = HTMLVisualElement | SVGVisualElement

/**
 * Elements created and not yet mounted, so children inserted in the same
 * commit can find their parent.
 */
const pendingElements = /*@__PURE__*/ new WeakMap<Element, AnyVisualElement>()

function findParent(element: Element) {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const parent = pendingElements.get(node) || visualElementStore.get(node)
        if (parent) return parent as AnyVisualElement
    }
    return undefined
}

interface Presence {
    /**
     * Start this element's exit, if it has one.
     */
    exit(): Promise<void> | undefined

    /**
     * Return to present after an exit was cancelled.
     */
    enter(): void
}

/**
 * Remix only tells the root of a removed subtree that it's leaving, so
 * the root starts the exits of the motion elements inside it, as
 * AnimatePresence does in React, and waits for all of them.
 */
const presences = /*@__PURE__*/ new WeakMap<Element, Presence>()

/**
 * Take an exiting element out of the layout, where it is now, so the
 * elements around it move at once. Returns a function that puts it back.
 */
function measurePop(node: Element) {
    if (!(node instanceof HTMLElement)) return
    const parent = node.offsetParent as HTMLElement | null
    const { offsetTop: top, offsetLeft: left } = node
    const { width, height } = getComputedStyle(node)
    const w = parseFloat(width)
    const h = parseFloat(height)
    return {
        top,
        left,
        right: (parent?.offsetWidth || 0) - w - left,
        bottom: (parent?.offsetHeight || 0) - h - top,
        width,
        height,
    }
}

type PopBox = NonNullable<ReturnType<typeof measurePop>>

function popLayout(
    node: Element,
    box = measurePop(node),
    anchorX: "left" | "right" = "left",
    anchorY: "top" | "bottom" = "top"
) {
    if (!(node instanceof HTMLElement) || !box) return
    const { style } = node
    const popped: Values = {
        position: "absolute",
        width: box.width,
        height: box.height,
        [anchorX]: box[anchorX] + "px",
        [anchorY]: box[anchorY] + "px",
    }
    const previous: Values = {}
    for (const key in popped) previous[key] = style[key as any]
    Object.assign(style, popped)
    return () => Object.assign(style, previous)
}

const getLayoutNode = (node: Element) =>
    acquireProjectionNode(node as HTMLElement)[0]

/**
 * layoutId elements exiting within AnimatePresence, and how to finish
 * their exit. A layout snapshot resets node options, so they're marked
 * again after each one.
 */
const exitingLayouts = /*@__PURE__*/ new Map<Element, VoidFunction>()

function markLayoutExit(node: Element) {
    const projection = getLayoutNode(node)
    projection.isPresent = false
    /**
     * Nodes created in this snapshot promote in document order, so an
     * exiting node can resume from the one that takes over from it.
     */
    projection.resumeFrom = undefined
    projection.setOptions({ onExitComplete: exitingLayouts.get(node) })
    return projection
}

/**
 * Layout animations: every host with `layout` or `layoutId` that is about
 * to update shares one animateLayout() for the whole document. It must
 * snapshot synchronously in `beforeUpdate`, as Remix changes the DOM
 * straight after, and finishes when the first host commits.
 */
let layoutPass:
    | { builder: LayoutAnimationBuilder; commit: VoidFunction }
    | undefined

function snapshotLayout() {
    if (layoutPass) return
    flushInserts()

    let commit!: VoidFunction
    const committed = new Promise<void>((resolve) => {
        commit = () => {
            // A late fallback mustn't end a newer pass.
            if (layoutPass?.commit === commit) layoutPass = undefined
            resolve()
        }
    })

    layoutPass = {
        builder: animateLayout(document.documentElement, () => committed),
        commit,
    }
    flushLayoutSnapshots()
    exitingLayouts.forEach((_, node) => markLayoutExit(node))

    /**
     * If the update is abandoned, don't block the next one.
     */
    requestAnimationFrame(commit)
}

/**
 * Animate to the latest props. Then forget which children entered with
 * this render, so the next children's `delayChildren` stagger starts
 * from 0, as in React.
 */
function animateChanges(visualElement: AnyVisualElement | undefined) {
    if (!visualElement) return
    visualElement.animationState?.animateChanges()
    visualElement.enteringChildren = undefined
}

let presenceId = 0

const motionMixin = /*@__PURE__*/ createMixin<Element, [props: MotionProps]>(
    (handle, tag) => {
        const isSVG = isSVGElement(tag)
        let props: MotionProps = {}
        let element: Element | undefined
        let visualElement: AnyVisualElement | undefined
        let releaseProjection: VoidFunction | undefined
        let initialValues: Values | undefined
        let presence: PresenceContextProps | null = null
        let isExiting = false
        let isInitialBlocked: boolean | undefined
        const id = String(presenceId++)

        const getConfig = () =>
            handle.context.get(MotionConfig) as MotionConfigProps | undefined
        const getVariantParent = () =>
            handle.context.get(VariantProvider) as VariantContext | undefined
        const getGroup = () =>
            handle.context.get(AnimatePresence) as PresenceGroup | undefined
        const getPresenceChild = () =>
            handle.context.get(PresenceChild) as
                | PresenceChildContext
                | undefined

        /**
         * Inside AnimatePresence: the exit this element started.
         */
        let exitDone: Promise<void> | undefined
        let exitResolvers: VoidFunction[] = []
        let pop: VoidFunction | undefined
        let popBox: PopBox | undefined
        let restoreLayout: VoidFunction | undefined

        const getProps = (): MotionProps => {
            const transition = props.transition ?? getConfig()?.transition
            return transition ? { ...props, transition } : props
        }

        const getLayoutId = () => {
            const group = (
                handle.context.get(LayoutGroup) as LayoutGroupProps | undefined
            )?.id
            const { layoutId } = props
            return group && layoutId ? group + "-" + layoutId : layoutId
        }

        const setPresence = (
            isPresent: boolean,
            onExitComplete?: VoidFunction
        ) => {
            const custom = getPresenceChild()?.custom
            presence = {
                id,
                isPresent,
                register: () => () => {},
                onExitComplete,
                custom: custom === undefined ? props.custom : custom,
            }
            visualElement!.update(getProps() as any, presence)
            visualElement!.updateFeatures()
        }

        /**
         * Drag measures layout, so it needs a projection node before its
         * feature mounts, including when drag is turned on later. A
         * layoutId element joins its stack when it mounts, as in React.
         */
        const acquireProjection = (node: Element) => {
            if (!props.drag && !getLayoutId()) return
            releaseProjection ||= acquireProjectionNode(node as HTMLElement)[1]
            props.drag &&
                getLayoutNode(node).setOptions({ alwaysMeasureLayout: true })
        }

        /**
         * Exit within AnimatePresence: animate `exit`, and hand a layoutId
         * over to the element that replaces it, as React's exit does.
         */
        const startExit = (layoutId?: string) => {
            const current = visualElement!
            const exits: Promise<void>[] = []

            if (props.exit) {
                isExiting = true
                exits.push(
                    new Promise<void>((resolve) => {
                        exitResolvers.push(resolve)
                        handle.queueTask(() => {
                            if (visualElement === current && isExiting) {
                                setPresence(false, resolve)
                            } else resolve()
                        })
                    })
                )
            }

            const node = element!
            if (layoutId) {
                exits.push(
                    new Promise<void>((resolve) => {
                        exitingLayouts.set(node, () => {
                            exitingLayouts.delete(node)
                            resolve()
                        })
                        /**
                         * Measure the layout now, before the DOM changes,
                         * and hand over as React does before its commit.
                         */
                        snapshotLayout()
                        const projection = markLayoutExit(node)
                        /**
                         * If an element replaces this one, it crossfades
                         * from it and calls onExitComplete.
                         */
                        projection.relegate() ||
                            frame.postRender(() => {
                                const stack = projection.getStack()
                                if (!stack || stack.lead === projection) {
                                    exitingLayouts.get(node)?.()
                                }
                            })
                    })
                )
            }

            // In case this element didn't update in the commit.
            handle.queueTask(beforeLayout)
            if (layoutId) handle.queueTask(() => layoutPass?.commit())

            return Promise.all(exits).then(() => {})
        }

        handle.addEventListener("insert", ({ node }) => {
            element = node
            loadRemixFeatures()

            presences.set(node, {
                exit: () => {
                    if (!props.exit || !visualElement || isExiting) return
                    isExiting = true
                    return new Promise<void>((resolve) =>
                        setPresence(false, resolve)
                    )
                },
                enter: () => {
                    if (!isExiting || !visualElement) return
                    isExiting = false
                    setPresence(true)
                },
            })

            queueInsert(
                () => {
                    /**
                     * Removed before it mounted.
                     */
                    if (element !== node) return

                    const nodeProps = getProps()
                    const VisualElement = isSVG
                        ? SVGVisualElement
                        : HTMLVisualElement
                    visualElement = new VisualElement({
                        parent: findParent(node),
                        props: nodeProps as any,
                        presenceContext: presence,
                        blockInitialAnimation: isInitialBlocked,
                        reducedMotionConfig: getConfig()?.reducedMotion,
                        visualState: {
                            latestValues: makeLatestValues(
                                nodeProps,
                                getVariantParent(),
                                isSVG,
                                isInitialBlocked
                            ),
                            renderState: createRenderState(),
                        },
                    }) as AnyVisualElement
                    pendingElements.set(node, visualElement)
                },
                () => {
                    pendingElements.delete(node)
                    if (element !== node || !visualElement) return

                    visualElement.mount(node as any)

                    /**
                     * The element rendered its first values. Render the
                     * latest, in case they changed before it mounted.
                     */
                    visualElement.scheduleRenderMicrotask()

                    acquireProjection(node)
                    visualElement.updateFeatures()
                },
                () => {
                    if (element === node) animateChanges(visualElement)
                }
            )
        })

        handle.addEventListener("beforeRemove", (event) => {
            const node = element
            if (!node || isExiting || getPresenceChild()) return

            const leaving = [node, ...node.querySelectorAll("*")]
                .map((el) => presences.get(el))
                .filter(Boolean) as Presence[]
            const exited = leaving
                .map((presence) => presence.exit())
                .filter(Boolean)

            if (!exited.length) return

            let cancel!: VoidFunction
            const done = new Promise<void>((resolve) => {
                cancel = resolve
                Promise.all(exited).then(() => resolve())
            })

            event.persistNode((signal) => {
                const reclaim = () => {
                    leaving.forEach((presence) => presence.enter())
                    cancel()
                }
                if (signal.aborted) reclaim()
                signal.addEventListener("abort", reclaim)
                return done
            })
        })

        handle.addEventListener("remove", () => {
            if (element) {
                presences.delete(element)
                // Removed by its own component mid-exit: its exits are done.
                exitingLayouts.get(element)?.()
            }
            exitResolvers.forEach((resolve) => resolve())
            exitResolvers = []
            releaseProjection?.()
            visualElement?.unmount()
            releaseProjection = visualElement = element = undefined
            presence = null
        })

        /**
         * After the DOM changes, before the layout animation measures it:
         * take an exiting element out of the layout.
         */
        const beforeLayout = () => {
            pop?.()
            pop = undefined
        }

        handle.addEventListener("beforeUpdate", ({ node }) => {
            /**
             * Where this element is before the DOM changes, in case it
             * exits in this update and leaves the layout.
             */
            if (getPresenceChild()?.popLayout && !exitDone) {
                popBox = measurePop(node)
            }

            const hasLayout = props.layout || props.layoutId
            if (hasLayout) snapshotLayout()
            else if (!getPresenceChild()?.popLayout) return

            /**
             * Set the options once this render's props have arrived, after
             * the snapshot has reset them, and before the layout animation
             * starts.
             */
            queueMicrotask(() => {
                beforeLayout()
                // Removed in this update.
                if (!hasLayout || element !== node) return
                /**
                 * The layout animation's node, which isn't always the
                 * VisualElement's: animateLayout() can adopt the element
                 * before it mounts.
                 */
                getLayoutNode(node).setOptions({
                    transition: getProps().transition as any,
                    animationType:
                        typeof props.layout === "string"
                            ? props.layout
                            : "both",
                    layoutAnchor: props.layoutAnchor,
                    crossfade: props.layoutCrossfade,
                })
            })
        })

        handle.addEventListener("commit", () => layoutPass?.commit())

        return (nextProps, hostProps) => {
            props = {
                ...nextProps,
                style: (hostProps.style as any) ?? nextProps.style,
            }

            /**
             * Motion renders motion values passed as attributes, like
             * <motion.circle cx={cx} />, so Remix never sees them.
             */
            const motionAttrs: Values = {}
            for (const key in hostProps) {
                const value = (hostProps as Values)[key]
                if (key !== "style" && isMotionValue(value)) {
                    ;(props as Values)[key] = value
                    motionAttrs[key] = undefined
                }
            }

            const { layout } = props
            const layoutId = getLayoutId()

            const presenceChild = getPresenceChild()
            if (presenceChild && visualElement && element) {
                if (!presenceChild.isPresent) {
                    if (!exitDone) {
                        exitDone = startExit(layoutId)
                        /**
                         * The outermost motion element of the child leaves
                         * the layout. Parents render before children.
                         */
                        if (presenceChild.popLayout && !presenceChild.popped) {
                            presenceChild.popped = true
                            const node = element
                            const { anchorX, anchorY } = presenceChild
                            const box = popBox
                            pop = () =>
                                (restoreLayout = popLayout(
                                    node,
                                    box,
                                    anchorX,
                                    anchorY
                                ))
                        }
                    }
                    presenceChild.exits.push(exitDone)
                } else if (exitDone) {
                    exitDone = pop = undefined
                    exitResolvers = []
                    restoreLayout?.()
                    restoreLayout = undefined
                    if (isExiting) {
                        isExiting = false
                        setPresence(true)
                    }
                    if (exitingLayouts.delete(element)) {
                        const projection = getLayoutNode(element)
                        projection.isPresent = true
                        projection.setOptions({ onExitComplete: undefined })
                        projection.promote()
                    }
                }
            }

            /**
             * A layoutId element inserted during a layout pass animates
             * from the element it replaces, with its own transition.
             */
            if (layoutId && layoutPass && !element) {
                layoutPass.builder.shared(layoutId, getProps().transition || {})
            }

            if (visualElement) {
                const current = visualElement
                handle.queueTask(() =>
                    queueUpdate(
                        () => {
                            if (visualElement !== current) return
                            current.update(getProps() as any, presence)
                            acquireProjection(element!)
                            current.updateFeatures()
                        },
                        () => visualElement === current && animateChanges(current)
                    )
                )
            }

            /**
             * Render the values Motion starts from, on the server too. Keep
             * rendering the same values on later renders, so Remix's
             * per-property diff never overwrites what Motion animated.
             */
            if (!initialValues) {
                const group = getGroup()
                isInitialBlocked =
                    group?.isFirstRender && group.props.initial === false
                initialValues = renderValues(
                    makeLatestValues(
                        getProps(),
                        getVariantParent(),
                        isSVG,
                        isInitialBlocked
                    ),
                    props,
                    tag,
                    isSVG
                )
            }

            const { style: initialStyle, ...attrs } = initialValues
            const patch: Values = { ...motionAttrs, ...attrs }
            const style = { ...splitStyle(props.style, props), ...initialStyle }

            /**
             * As React: no ghost image, text selection or scrolling in the
             * drag direction, and tap gestures are keyboard accessible.
             */
            if (!isSVG) {
                const { drag } = props
                if (drag && props.dragListener !== false) {
                    patch.draggable = false
                    style.userSelect =
                        style.WebkitUserSelect =
                        style.WebkitTouchCallout =
                            "none"
                    style.touchAction =
                        drag === true ? "none" : `pan-${drag === "x" ? "y" : "x"}`
                }
                if (
                    hostProps.tabIndex === undefined &&
                    (props.onTap || props.onTapStart || props.whileTap)
                ) {
                    patch.tabIndex = 0
                }
            }
            if (Object.keys(style).length) patch.style = style
            if (layout) patch["data-layout"] = layout === true ? "" : layout
            if (layoutId) patch["data-layout-id"] = layoutId

            return createElement(handle.element, { ...hostProps, ...patch })
        }
    }
)

export type MotionComponentProps = MotionProps & {
    children?: RemixNode | MotionValue
    [key: string]: any
}

export type MotionComponent = (
    handle: Handle<MotionComponentProps>
) => () => RemixNode

const motionComponents = /*@__PURE__*/ new WeakSet<MotionComponent>()

function createMotionComponent(tag: string): MotionComponent {
    const component: MotionComponent = (handle) => {
        let text: { value: MotionValue; initial: string } | undefined

        return () => {
            let { children, mix, presenceKey, ...rest } = handle.props
            const motionProps: Values = {}
            const hostProps: Values = {}

            for (const key in rest) {
                if (key === "style" || !isValidMotionProp(key)) {
                    hostProps[key] = rest[key]
                }
                if (isValidMotionProp(key)) motionProps[key] = rest[key]
            }

            /**
             * A motion value child renders its first value. Motion then
             * updates the text, so keep rendering the same text.
             */
            if (isMotionValue(children)) {
                motionProps.children = children
                if (text?.value !== children) {
                    text = { value: children, initial: String(children.get()) }
                }
                children = text.initial
            }

            const parent = handle.context.get(VariantProvider) as
                | VariantContext
                | undefined

            return createElement(
                tag,
                {
                    ...hostProps,
                    ...(presenceKey != null && { key: presenceKey }),
                    mix: [motionMixin(motionProps), mix],
                },
                createElement(
                    VariantProvider,
                    { value: getVariantContext(motionProps, parent) },
                    children
                )
            )
        }
    }
    motionComponents.add(component)
    return component
}

const components = /*@__PURE__*/ new Map<string, MotionComponent>()

type Motion = typeof motionMixin & {
    [Tag in
        | keyof HTMLElementTagNameMap
        | keyof SVGElementTagNameMap]: MotionComponent
}

/**
 * Animate elements with Motion in Remix 3, with the same props as React's
 * `<motion.div>`:
 *
 * ```tsx
 * <motion.ul initial="hidden" animate="visible" variants={list}>
 *     {items.map((item) => (
 *         <motion.li key={item.id} variants={item} exit={{ opacity: 0 }} />
 *     ))}
 * </motion.ul>
 * ```
 *
 * `initial` is rendered on the server. `exit` keeps an element, and
 * everything inside it, in the DOM until its exit animation finishes.
 *
 * `motion(props)` is the same as a mixin for any element, as used by the
 * components.
 *
 * Experimental: Remix 3's component API is new, so this API can change
 * in a minor release.
 *
 * @public
 */
export const motion = /*@__PURE__*/ new Proxy(motionMixin, {
    get(target, key, receiver) {
        if (typeof key !== "string" || key in target) {
            return Reflect.get(target, key, receiver)
        }
        let component = components.get(key)
        if (!component) {
            component = createMotionComponent(key)
            components.set(key, component)
        }
        return component
    },
}) as Motion

const scopeMixin = /*@__PURE__*/ createMixin<
    HTMLElement,
    [setup: ScopeSetup, options?: ScopeOptions]
>(
    (handle) => {
        let setup: ScopeSetup = () => {}
        let scopeOptions: ScopeOptions | undefined
        let scope: MotionScope | undefined

        handle.addEventListener("insert", ({ node }) => {
            scope = createScope(node, (s) => setup(s), scopeOptions)
        })

        handle.addEventListener("remove", () => {
            scope?.cancel()
            scope = undefined
        })

        return (nextSetup, nextOptions) => {
            setup = nextSetup
            scopeOptions = nextOptions
            return handle.element
        }
    },
    { ssr: false }
)

/**
 * The `mix` form of vanilla `scopeMotion()`: run `setup` in a scope rooted
 * at this element, so selectors resolve inside it. Everything it starts is
 * cancelled, and inline styles restored, when the element is removed.
 *
 * ```tsx
 * <ul mix={scopeMotion(() => {
 *     animate("li", { opacity: [0, 1] }, { delay: stagger(0.05) })
 * })} />
 * ```
 *
 * @public
 */
export const scopeMotion = scopeMixin

/**
 * Drag, or grab with Space and move with the arrow keys, to reorder a
 * list, with the same props as React's `Reorder`:
 *
 * ```tsx
 * <Reorder.Group values={items} onReorder={(next) => {
 *     items = next
 *     handle.update()
 * }}>
 *     {items.map((item) => (
 *         <Reorder.Item key={item} value={item}>{item}</Reorder.Item>
 *     ))}
 * </Reorder.Group>
 * ```
 *
 * @public
 */
export const Reorder = /*@__PURE__*/ createReorder(motion)
