import {
    acquireProjectionNode,
    animateLayout,
    buildHTMLStyles,
    flushLayoutSnapshots,
    HTMLVisualElement,
    isControllingVariants,
    isForcedMotionValue,
    isMotionValue,
    isVariantNode,
    resolveMotionValue,
    resolveVariantFromProps,
    scopeMotion,
    scrapeHTMLMotionValuesFromProps,
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

interface VariantContext {
    initial?: false | VariantLabels
    animate?: VariantLabels
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

/**
 * The values a motion element renders before it animates, as React's
 * `makeLatestValues`.
 */
function makeLatestValues(props: MotionProps, context?: VariantContext) {
    const values: ResolvedValues = {}

    const motionValues = scrapeHTMLMotionValuesFromProps(props as any, {})
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

    const isBlocked = initial === false
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

function renderStyle(latestValues: ResolvedValues) {
    const state = { style: {}, vars: {}, transform: {}, transformOrigin: {} }
    buildHTMLStyles(state, latestValues)
    return { ...state.vars, ...state.style } as Values
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
            for (let i = queue.length - 1; i >= 0; i--) queue[i][0]()
            for (let i = queue.length - 1; i >= 0; i--) queue[i][1]()
            // ...and children animate first, as with React's effects.
            for (const [, , animate] of queue) animate()
        })
    }
    insertQueue.push([create, mount, animate])
}

/**
 * Elements created and not yet mounted, so children inserted in the same
 * commit can find their parent.
 */
const pendingElements = new WeakMap<Element, HTMLVisualElement>()

function findParent(element: Element) {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const parent = pendingElements.get(node) || visualElementStore.get(node)
        if (parent) return parent as HTMLVisualElement
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

const motionMixin = createMixin<HTMLElement, [props: MotionProps]>((handle) => {
    let props: MotionProps = {}
    let element: HTMLElement | undefined
    let visualElement: HTMLVisualElement | undefined
    let releaseProjection: VoidFunction | undefined
    let initialStyle: Values | undefined
    let presence: PresenceContextProps | null = null
    const id = String(presenceId++)

    const getConfig = () =>
        handle.context.get(MotionConfig) as MotionConfigProps | undefined
    const getVariantParent = () =>
        handle.context.get(VariantProvider) as VariantContext | undefined

    const getProps = (): MotionProps => {
        const transition = props.transition ?? getConfig()?.transition
        return transition ? { ...props, transition } : props
    }

    const setPresence = (isPresent: boolean, onExitComplete?: VoidFunction) => {
        presence = {
            id,
            isPresent,
            register: () => () => {},
            onExitComplete,
            custom: props.custom,
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
                const nodeProps = getProps()
                visualElement = new HTMLVisualElement({
                    parent: findParent(node),
                    props: nodeProps as any,
                    presenceContext: presence,
                    reducedMotionConfig: getConfig()?.reducedMotion,
                    visualState: {
                        latestValues: makeLatestValues(
                            nodeProps,
                            getVariantParent()
                        ),
                        renderState: {
                            transform: {},
                            transformOrigin: {},
                            style: {},
                            vars: {},
                        },
                    },
                })
                pendingElements.set(node, visualElement)
            },
            () => {
                pendingElements.delete(node)
                if (element !== node || !visualElement) return

                visualElement.mount(node)

                /**
                 * Drag measures layout, so it needs a projection node
                 * before its feature mounts.
                 */
                if (props.drag) {
                    const [projection, release] = acquireProjectionNode(node)
                    projection.setOptions({ alwaysMeasureLayout: true })
                    releaseProjection = release
                }

                visualElement.updateFeatures()
            },
            () => visualElement?.animationState?.animateChanges()
        )
    })

    let isExiting = false

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

        event.persistNode(
            (signal) =>
                new Promise<void>((resolve) => {
                    Promise.all(exited).then(() => resolve())
                    signal.addEventListener("abort", () => {
                        leaving.forEach((presence) => presence.enter())
                        resolve()
                    })
                })
        )
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

        const { layout, layoutId } = props

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
         * per-property style diff never overwrites what Motion animated.
         */
        initialStyle ||= renderStyle(
            makeLatestValues(getProps(), getVariantParent())
        )

        const patch: Values = {}
        const style = { ...initialStyle, ...splitStyle(props.style, props) }
        if (Object.keys(style).length) patch.style = style
        if (layout) patch["data-layout"] = layout === true ? "" : layout
        if (layoutId) patch["data-layout-id"] = layoutId

        return createElement(handle.element, { ...hostProps, ...patch })
    }
})

export type MotionComponentProps = MotionProps & {
    children?: RemixNode
    [key: string]: any
}

export type MotionComponent = (
    handle: Handle<MotionComponentProps>
) => () => RemixNode

function createMotionComponent(tag: string): MotionComponent {
    return (handle) => () => {
        const { children, mix, ...rest } = handle.props
        const motionProps: Values = {}
        const hostProps: Values = {}

        for (const key in rest) {
            if (key === "style" || !isValidMotionProp(key)) {
                hostProps[key] = rest[key]
            }
            if (isValidMotionProp(key)) motionProps[key] = rest[key]
        }

        const parent = handle.context.get(VariantProvider) as
            | VariantContext
            | undefined

        return createElement(
            tag,
            { ...hostProps, mix: [motionMixin(motionProps), mix] },
            createElement(
                VariantProvider,
                { value: getVariantContext(motionProps, parent) },
                children
            )
        )
    }
}

const components = new Map<string, MotionComponent>()

type Motion = typeof motionMixin & {
    [Tag in keyof HTMLElementTagNameMap]: MotionComponent
}

/**
 * Animate elements with Motion in Remix 3, either as components with the
 * same props as React's `<motion.div>`:
 *
 * ```tsx
 * <motion.ul initial="hidden" animate="visible" variants={list}>
 *     {items.map((item) => (
 *         <motion.li key={item.id} variants={item} exit={{ opacity: 0 }} />
 *     ))}
 * </motion.ul>
 * ```
 *
 * Or as a mixin on any element:
 *
 * ```tsx
 * <li mix={motion({ animate: { opacity: 1 }, whileHover: { scale: 1.1 } })} />
 * ```
 *
 * `initial` is rendered on the server. `exit` keeps an element, and
 * everything inside it, in the DOM until its exit animation finishes.
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
            scope = scopeMotion(node, (s) => setup(s), scopeOptions)
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
 * Run `setup` in a `scopeMotion()` scope rooted at this element, so
 * selectors resolve inside it. Everything it starts is cancelled, and
 * inline styles restored, when the element is removed.
 *
 * ```tsx
 * <ul mix={motionScope(() => {
 *     animate("li", { opacity: [0, 1] }, { delay: stagger(0.05) })
 * })} />
 * ```
 *
 * @public
 */
export const motionScope = scopeMixin
