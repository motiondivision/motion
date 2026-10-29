import {
    acquireProjectionNode,
    animateLayout,
    buildHTMLStyles,
    buildSVGAttrs,
    flushLayoutSnapshots,
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
    exit(done: Promise<void>): void
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
        handle.context.set(handle.props)
        return handle.props.children
    }
}

const flatten = (node: RemixNode): any[] =>
    Array.isArray(node) ? (node as any[]).flat(Infinity) : [node]

const getKeys = (node: RemixNode) =>
    flatten(node)
        .map((child) => child?.key)
        .join()

/**
 * A motion component is a component, so Remix can't see the key of the
 * element it renders, and can't reuse that element when it comes back
 * during its exit. Pass each child's key to the element.
 */
const withPresenceKeys = (node: RemixNode) =>
    flatten(node).map((child) =>
        child?.key != null && motionComponents.has(child.type)
            ? { ...child, props: { ...child.props, presenceKey: child.key } }
            : child
    )

/**
 * Motion elements animate `exit` when they're removed anywhere in the
 * tree. Wrap them in `AnimatePresence` to choose how entering and exiting
 * elements share the screen, skip their first `initial` animation, or
 * know when exits finish.
 *
 * @public
 */
export function AnimatePresence(
    handle: Handle<AnimatePresenceProps, PresenceGroup>
) {
    let exiting = 0
    let shown: RemixNode
    let hasShown = false
    let isSwapping = false

    const group: PresenceGroup = {
        props: handle.props,
        isFirstRender: true,
        exit: (done) => {
            exiting++
            done.then(() => {
                if (--exiting) return
                handle.props.onExitComplete?.()
                if (isSwapping) handle.update()
            })
        },
    }

    return () => {
        handle.context.set(group)
        if (group.isFirstRender) {
            handle.queueTask(() => (group.isFirstRender = false))
        }

        const children = withPresenceKeys(handle.props.children)
        if (handle.props.mode !== "wait") return children

        /**
         * When the children change, remove the old ones first, and render
         * the new ones once their exits finish.
         */
        if (exiting) return null
        if (hasShown && !isSwapping && getKeys(shown) !== getKeys(children)) {
            isSwapping = true
            handle.queueTask(() => {
                if (!exiting) handle.update()
            })
            return null
        }
        isSwapping = false
        hasShown = true
        return (shown = children)
    }
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
        queueMicrotask(() => {
            const queue = insertQueue!
            insertQueue = undefined

            // Parents first, so children join their variant tree...
            for (let i = queue.length - 1; i >= 0; i--) run(queue[i][0])
            for (let i = queue.length - 1; i >= 0; i--) run(queue[i][1])
            // ...and children animate first, as with React's effects.
            for (const [, , animate] of queue) run(animate)
        })
    }
    insertQueue.push([create, mount, animate])
}

type AnyVisualElement = HTMLVisualElement | SVGVisualElement

/**
 * Elements created and not yet mounted, so children inserted in the same
 * commit can find their parent.
 */
const pendingElements = new WeakMap<Element, AnyVisualElement>()

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
const presences = new WeakMap<Element, Presence>()

/**
 * Take an exiting element out of the layout, where it is now, so the
 * elements around it move at once. Returns a function that puts it back.
 */
function popLayout(node: Element) {
    if (!(node instanceof HTMLElement)) return
    const { style } = node
    const popped: Values = {
        position: "absolute",
        top: node.offsetTop + "px",
        left: node.offsetLeft + "px",
        width: node.offsetWidth + "px",
        height: node.offsetHeight + "px",
    }
    const previous: Values = {}
    for (const key in popped) previous[key] = style[key as any]
    Object.assign(style, popped)
    return () => Object.assign(style, previous)
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

    let commit!: VoidFunction
    const committed = new Promise<void>((resolve) => {
        commit = () => {
            layoutPass = undefined
            resolve()
        }
    })

    layoutPass = {
        builder: animateLayout(document.documentElement, () => committed),
        commit,
    }
    flushLayoutSnapshots()

    /**
     * If the update is abandoned, don't block the next one.
     */
    requestAnimationFrame(commit)
}

let presenceId = 0

const motionMixin = createMixin<Element, [props: MotionProps]>(
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
            const custom = getGroup()?.props.custom
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
                     * Drag measures layout, so it needs a projection node
                     * before its feature mounts.
                     */
                    if (props.drag) {
                        const [projection, release] = acquireProjectionNode(
                            node as HTMLElement
                        )
                        projection.setOptions({ alwaysMeasureLayout: true })
                        releaseProjection = release
                    }

                    visualElement.updateFeatures()
                },
                () => {
                    if (element === node) {
                        visualElement?.animationState?.animateChanges()
                    }
                }
            )
        })

        handle.addEventListener("beforeRemove", (event) => {
            const node = element
            if (!node || isExiting) return

            const leaving = [node, ...node.querySelectorAll("*")]
                .map((el) => presences.get(el))
                .filter(Boolean) as Presence[]
            const exited = leaving
                .map((presence) => presence.exit())
                .filter(Boolean)

            if (!exited.length) return

            const group = getGroup()
            const restore =
                group?.props.mode === "popLayout" ? popLayout(node) : undefined

            let cancel!: VoidFunction
            const done = new Promise<void>((resolve) => {
                cancel = resolve
                Promise.all(exited).then(() => resolve())
            })
            group?.exit(done)

            event.persistNode((signal) => {
                const reclaim = () => {
                    restore?.()
                    leaving.forEach((presence) => presence.enter())
                    cancel()
                }
                if (signal.aborted) reclaim()
                signal.addEventListener("abort", reclaim)
                return done
            })
        })

        handle.addEventListener("remove", () => {
            if (element) presences.delete(element)
            releaseProjection?.()
            visualElement?.unmount()
            releaseProjection = visualElement = element = undefined
            presence = null
        })

        handle.addEventListener("beforeUpdate", ({ node }) => {
            if (!props.layout && !props.layoutId) return
            snapshotLayout()

            const projection = visualElementStore.get(node)?.projection
            projection?.setOptions({
                transition: getProps().transition as any,
                animationType:
                    typeof props.layout === "string" ? props.layout : "both",
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

            /**
             * A layoutId element inserted during a layout pass animates
             * from the element it replaces, with its own transition.
             */
            if (layoutId && layoutPass && !element) {
                layoutPass.builder.shared(layoutId, getProps().transition || {})
            }

            if (visualElement) {
                const current = visualElement
                handle.queueTask(() => {
                    if (visualElement !== current) return
                    current.update(getProps() as any, presence)
                    current.updateFeatures()
                    current.animationState?.animateChanges()
                })
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

const motionComponents = new WeakSet<MotionComponent>()

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

const components = new Map<string, MotionComponent>()

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
export const motion = new Proxy(motionMixin, {
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

const scopeMixin = createMixin<
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
