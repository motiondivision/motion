"use client"

import {
    addDomEvent,
    AnimationPlaybackControls,
    frame,
    hover,
    isMotionValue,
    press,
    TargetAndTransition,
    Transition,
    VariantLabels,
    Variants,
} from "motion-dom"
import {
    createContext,
    createElement,
    forwardRef,
    ForwardRefExoticComponent,
    JSX,
    Ref,
    RefAttributes,
    useContext,
    useEffect,
} from "react"
import {
    AnimationDefinition,
    resolveAnimationDefinitions,
    startAnimationDefinitions,
    stopAndDefineAnimations,
} from "../../../animation/animators/waapi/animate-elements"
import { usePresence } from "../../../components/AnimatePresence/use-presence"
import { MotionConfigContext } from "../../../context/MotionConfigContext"
import { PresenceContext } from "../../../context/PresenceContext"
import { MotionStyle } from "../../../motion/types"
import { useConstant } from "../../../utils/use-constant"
import { inView, InViewOptions } from "../../dom/viewport"

type Definition = boolean | VariantLabels | TargetAndTransition | undefined

export interface MiniMotionProps {
    initial?: Definition
    animate?: Definition
    exit?: Definition
    whileHover?: Definition
    whileTap?: Definition
    whileFocus?: Definition
    whileInView?: Definition
    viewport?: InViewOptions & { once?: boolean }
    transition?: Transition
    variants?: Variants
    custom?: any
    inherit?: boolean
    style?: MotionStyle
    onAnimationStart?: (definition: Definition) => void
    onAnimationComplete?: (definition: Definition) => void
    onHoverStart?: (event: PointerEvent) => void
    onHoverEnd?: (event: PointerEvent) => void
    onTapStart?: (event: PointerEvent) => void
    onTap?: (event: PointerEvent) => void
    onTapCancel?: (event: PointerEvent) => void
    onViewportEnter?: (entry: IntersectionObserverEntry | null) => void
    onViewportLeave?: (entry: IntersectionObserverEntry | null) => void
}

type Layer =
    | "animate"
    | "whileInView"
    | "whileFocus"
    | "whileHover"
    | "whileTap"
    | "exit"

/**
 * Lowest to highest priority.
 */
const layers: Layer[] = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "exit",
]

type Values = Record<string, any>

interface MiniNode {
    props: MiniMotionProps
    parent: MiniNode | null
    children: Set<MiniNode>
    active: { [K in Layer]?: boolean }
    element: HTMLElement | null
    ref?: Ref<HTMLElement>
    /**
     * The value each key returns to when no active layer sets it.
     */
    base: Values
    /**
     * The keyframes each CSS property was last animated to.
     */
    prev: Record<string, string>
    keys: Set<string>
    config: Transition | undefined
    presenceCustom: any
    isScheduled: boolean
    isMounted: boolean
    onExitComplete?: VoidFunction
    schedule: VoidFunction
    process: (delay?: number) => void
    setRef: (element: HTMLElement | null) => void
}

/**
 * Independent transforms are written to the individual CSS transform
 * properties so each can run as its own WAAPI animation. These apply as
 * translate, rotate, scale then `transform`, so rotateX, rotateY and skew
 * go in `transform`.
 */
const transforms: Array<[string, string[], string, number]> = [
    ["translate", ["x", "y", "z"], "px", 0],
    ["scale", ["scaleX", "scaleY"], "", 1],
    ["rotate", ["rotate"], "deg", 0],
    ["transform", ["rotateX", "rotateY", "skewX", "skewY"], "deg", 0],
]

const transformKeys = new Set(["scale"])
transforms.forEach(([, keys]) => keys.forEach((key) => transformKeys.add(key)))

const isLabel = (v: any): v is VariantLabels =>
    typeof v === "string" || Array.isArray(v)

const last = (v: any) => (Array.isArray(v) ? v[v.length - 1] : v)

/**
 * Convert Motion values (x, scale, opacity...) into CSS properties. Values
 * can be keyframe arrays, in which case so are their CSS properties.
 */
function toCSS(values: Values) {
    const css: Values = {}
    const sources: Record<string, string> = {}

    for (const key in values) {
        if (!transformKeys.has(key)) {
            css[key] = values[key]
            sources[key] = key
        }
    }

    for (const [name, keys, unit, initial] of transforms) {
        const get = (key: string, i: number) => {
            let v = values[key]
            if (v === undefined && name === "scale") v = values.scale
            v = Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v
            return v === undefined
                ? initial
                : typeof v === "number"
                ? v + unit
                : v
        }

        let length = 0
        for (const key of keys.concat(name === "scale" ? ["scale"] : [])) {
            if (values[key] === undefined) continue
            sources[name] = key
            length = Math.max(length, [].concat(values[key]).length)
        }
        if (!length) continue

        const keyframes: Array<string | null> = []
        for (let i = 0; i < length; i++) {
            const parts = keys.map((key) => get(key, i))
            keyframes.push(
                parts.includes(null)
                    ? null
                    : name === "transform"
                    ? keys.map((key, j) => `${key}(${parts[j]})`).join(" ")
                    : parts.join(" ")
            )
        }
        css[name] = length > 1 ? keyframes : keyframes[0]
    }

    return [css, sources] as const
}

function getLayer(node: MiniNode, layer: Layer): [Definition, boolean] {
    const definition = node.props[layer]
    if (definition !== undefined) {
        return [definition, layer === "animate" || !!node.active[layer]]
    }
    if (node.parent && node.props.inherit !== false) {
        const inherited = getLayer(node.parent, layer)
        if (isLabel(inherited[0])) return inherited
    }
    return [undefined, false]
}

function getInitial(node: MiniNode | null): Definition {
    if (!node) return
    const { initial } = node.props
    return initial !== undefined || node.props.inherit === false
        ? initial
        : getInitial(node.parent)
}

function resolve(
    node: MiniNode,
    definition: Definition,
    custom = node.props.custom
): TargetAndTransition | undefined {
    if (!isLabel(definition)) {
        return typeof definition === "object" ? definition : undefined
    }
    const target = {}
    for (const label of ([] as string[]).concat(definition)) {
        const variant = node.props.variants?.[label]
        Object.assign(
            target,
            typeof variant === "function" ? variant(custom, {}, {}) : variant
        )
    }
    return target
}

function resolveStyle(style: MotionStyle = {}) {
    const values: Values = {}
    for (const key in style) {
        const value = (style as any)[key]
        values[key] = isMotionValue(value) ? value.get() : value
    }
    return values
}

/**
 * Animations are started in three frame steps, so every component
 * starting one this frame stops existing animations (write), then reads
 * keyframes from the DOM (read), then starts its animations (write).
 */
let queue: Array<
    [AnimationDefinition[], (animations: AnimationPlaybackControls[]) => void]
> = []

const resolveQueue = () =>
    queue.forEach(([definitions]) => resolveAnimationDefinitions(definitions))

const startQueue = () => {
    const current = queue
    queue = []
    current.forEach(([definitions, onStart]) =>
        onStart(startAnimationDefinitions(definitions))
    )
}

function createNode(parent: MiniNode | null): MiniNode {
    const node: MiniNode = {
        props: {},
        parent,
        children: new Set(),
        active: {},
        element: null,
        base: {},
        prev: {},
        keys: new Set(),
        config: undefined,
        presenceCustom: undefined,
        isScheduled: false,
        isMounted: false,
        schedule: () => {
            node.isScheduled = true
            frame.setup(processSelf)
        },
        setRef: (element) => {
            node.element = element
            const { ref } = node
            typeof ref === "function"
                ? ref(element)
                : ref && ((ref as any).current = element)
        },
        process: (delay?: number) => {
            const { element, props, parent } = node

            /**
             * A parent that's processing this frame processes its
             * children too, with their stagger delay.
             */
            if (delay === undefined) {
                if (parent?.isScheduled) return
                delay = 0
            }
            node.isScheduled = false
            if (!element) return

            const values: Values = {}
            const transitions: Record<string, Transition | undefined> = {}
            const newKeys: string[] = []
            const defaultTransition = props.transition ?? node.config
            let transition = defaultTransition
            let animateTransition = transition
            let definition: Definition

            for (const layer of layers) {
                const [layerDefinition, isActive] = getLayer(node, layer)
                if (!isActive) continue
                const target = resolve(
                    node,
                    layerDefinition,
                    layer === "exit" ? node.presenceCustom : undefined
                )
                if (!target) continue

                const {
                    transition: layerTransition,
                    transitionEnd,
                    ...rest
                } = target

                definition = layerDefinition
                transition = layerTransition ?? defaultTransition
                if (layer === "animate") animateTransition = transition

                for (const key in rest) {
                    values[key] = (rest as any)[key]
                    transitions[key] = transition
                    if (!node.keys.has(key)) {
                        node.keys.add(key)
                        newKeys.push(key)
                    }
                }
            }

            /**
             * Values that no active layer sets return to their base value.
             */
            for (const key of node.keys) {
                if (key in values) continue
                values[key] = node.base[key]
                transitions[key] = animateTransition
            }

            const [css, sources] = toCSS(values)
            const groups = new Map<Transition | undefined, Values>()

            for (const name in css) {
                const keyframes = String(css[name])
                if (node.prev[name] === keyframes) continue

                const isFirst = !(name in node.prev)
                node.prev[name] = keyframes

                /**
                 * Skip the mount animation with initial={false}.
                 */
                if (isFirst && !node.isMounted && getInitial(node) === false)
                    continue

                const valueTransition = transitions[sources[name]]
                if (!groups.has(valueTransition)) {
                    groups.set(valueTransition, {})
                }
                groups.get(valueTransition)![name] = css[name]
            }
            node.isMounted = true

            const definitions: AnimationDefinition[] = []
            groups.forEach((keyframes, groupTransition) => {
                const options: Transition = { ...groupTransition }
                options.delay = (options.delay || 0) + delay!
                stopAndDefineAnimations(
                    element,
                    keyframes,
                    options,
                    undefined,
                    definitions
                )
            })

            const { onExitComplete } = node
            node.onExitComplete = undefined

            if (definitions.length || newKeys.length) {
                queue.push([
                    definitions,
                    (animations) => {
                        if (!animations.length) {
                            onExitComplete?.()
                            return
                        }
                        props.onAnimationStart?.(definition)
                        Promise.all(animations).then(() => {
                            node.props.onAnimationComplete?.(definition)
                            onExitComplete?.()
                        })
                    },
                ])

                /**
                 * Read the base value of values this component hasn't
                 * animated before, before they start animating.
                 */
                frame.read(() => {
                    for (const key of newKeys) {
                        if (key in node.base) continue
                        node.base[key] = transformKeys.has(key)
                            ? +key.startsWith("scale")
                            : getComputedStyle(element)[key as any]
                    }
                })
                frame.read(resolveQueue)
                frame.render(startQueue)
            } else {
                onExitComplete?.()
            }

            /**
             * Propagate to children, which inherit variant labels.
             */
            const {
                delayChildren = 0,
                staggerChildren = 0,
                staggerDirection = 1,
            } = (transition as any) || {}
            const numChildren = node.children.size
            let i = 0
            node.children.forEach((child) =>
                child.process(
                    delay! +
                        delayChildren +
                        staggerChildren *
                            (staggerDirection === 1
                                ? i++
                                : numChildren - 1 - i++)
                )
            )
        },
    }
    const processSelf = () => node.process()
    return node
}

const MiniContext = createContext<MiniNode | null>(null)

/**
 * A `motion` component that animates with the Web Animations API via mini
 * `animate`. It supports initial, animate, exit, variants (with
 * staggerChildren), whileHover, whileTap, whileFocus and whileInView.
 */
export function createMiniMotionComponent<
    T extends keyof JSX.IntrinsicElements
>(Component: T) {
    return forwardRef<HTMLElement, MiniMotionProps>(function MiniMotion(
        props,
        externalRef
    ) {
        const {
            initial,
            animate,
            exit,
            whileHover,
            whileTap,
            whileFocus,
            whileInView,
            viewport,
            transition,
            variants,
            custom,
            inherit,
            style,
            onAnimationStart,
            onAnimationComplete,
            onHoverStart,
            onHoverEnd,
            onTapStart,
            onTap,
            onTapCancel,
            onViewportEnter,
            onViewportLeave,
            ...rest
        } = props as MiniMotionProps & Record<string, any>

        const parent = useContext(MiniContext)
        const node = useConstant(() => createNode(parent))
        node.props = props
        node.ref = externalRef
        node.config = useContext(MotionConfigContext).transition
        node.presenceCustom = useContext(PresenceContext)?.custom

        const [isPresent, safeToRemove] = usePresence()
        if (!isPresent && !node.active.exit) {
            node.active.exit = true
            node.onExitComplete = safeToRemove!
        }

        /**
         * Render the initial values, or animate values with initial={false}.
         * These are computed once, so React never writes them again.
         */
        const initialValues = useConstant(() => {
            let definition = getInitial(node)
            if (definition === false) definition = getLayer(node, "animate")[0]
            const target: Values = { ...resolve(node, definition) }
            delete target.transition
            delete target.transitionEnd
            for (const key in target) {
                target[key] = last(target[key])
                node.base[key] = target[key]
            }
            return target
        })

        const styleValues = resolveStyle(style)
        for (const key in styleValues) {
            if (!(key in node.base)) node.base[key] = styleValues[key]
        }

        useEffect(() => {
            parent?.children.add(node)
            return () => {
                parent?.children.delete(node)
            }
        }, [])

        useEffect(node.schedule)

        /**
         * Render motion values in style outside React.
         */
        useEffect(() => {
            const render = () => {
                const { element } = node
                if (!element) return
                const [css] = toCSS(resolveStyle(node.props.style))
                for (const name in css) {
                    ;(element.style as any)[name] = css[name]
                }
            }
            const unsubscribers: VoidFunction[] = []
            for (const key in style) {
                const value = (style as any)[key]
                isMotionValue(value) &&
                    unsubscribers.push(
                        value.on("change", () => frame.render(render))
                    )
            }
            return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
        }, [style])

        const hasHover = !!(whileHover || onHoverStart || onHoverEnd)
        const hasTap = !!(whileTap || onTapStart || onTap || onTapCancel)
        const hasFocus = !!whileFocus
        const hasInView = !!(whileInView || onViewportEnter || onViewportLeave)

        useEffect(() => {
            const { element } = node
            if (!element) return
            const setActive = (layer: Layer, isActive: boolean) => {
                node.active[layer] = isActive
                node.schedule()
            }
            const cleanup: VoidFunction[] = []

            hasHover &&
                cleanup.push(
                    hover(element, (_, startEvent) => {
                        setActive("whileHover", true)
                        node.props.onHoverStart?.(startEvent)
                        return (endEvent) => {
                            setActive("whileHover", false)
                            node.props.onHoverEnd?.(endEvent)
                        }
                    })
                )

            hasTap &&
                cleanup.push(
                    press(element, (_, startEvent) => {
                        setActive("whileTap", true)
                        node.props.onTapStart?.(startEvent)
                        return (endEvent, { success }) => {
                            setActive("whileTap", false)
                            const { onTap, onTapCancel } = node.props
                            ;(success ? onTap : onTapCancel)?.(endEvent)
                        }
                    })
                )

            hasFocus &&
                cleanup.push(
                    addDomEvent(element, "focus", () => {
                        let isFocusVisible = true
                        try {
                            isFocusVisible = element.matches(":focus-visible")
                        } catch (e) {}
                        isFocusVisible && setActive("whileFocus", true)
                    }),
                    addDomEvent(element, "blur", () =>
                        setActive("whileFocus", false)
                    )
                )

            hasInView &&
                cleanup.push(
                    inView(
                        element,
                        (_, entry) => {
                            setActive("whileInView", true)
                            node.props.onViewportEnter?.(entry)
                            if (viewport?.once) return
                            return (leaveEntry) => {
                                setActive("whileInView", false)
                                node.props.onViewportLeave?.(leaveEntry)
                            }
                        },
                        viewport
                    )
                )

            return () => cleanup.forEach((c) => c())
        }, [hasHover, hasTap, hasFocus, hasInView])

        return createElement(
            MiniContext.Provider,
            { value: node },
            createElement(Component, {
                ...rest,
                ref: node.setRef,
                style: toCSS({ ...styleValues, ...initialValues })[0],
            })
        )
    }) as unknown as ForwardRefExoticComponent<
        Omit<JSX.IntrinsicElements[T], keyof MiniMotionProps | "ref"> &
            MiniMotionProps &
            RefAttributes<HTMLElement>
    >
}

type MiniMotionComponents = {
    [K in keyof JSX.IntrinsicElements]: ReturnType<
        typeof createMiniMotionComponent<K>
    >
}

const cache = new Map<string, any>()

export const motion = /*@__PURE__*/ new Proxy({} as MiniMotionComponents, {
    get: (_, key: string) => {
        if (!cache.has(key))
            cache.set(key, createMiniMotionComponent(key as any))
        return cache.get(key)
    },
})
