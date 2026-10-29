import {
    animate,
    animateLayout,
    buildHTMLStyles,
    drag,
    flushLayoutSnapshots,
    hover,
    inView,
    press,
    scopeMotion,
    transformProps,
    visualElementStore,
    type AnimationOptions,
    type DOMKeyframesDefinition,
    type DragOptions,
    type LayoutAnimationBuilder,
    type MotionScope,
    type ScopeOptions,
    type ScopeSetup,
} from "framer-motion/dom"
import { createElement, createMixin } from "remix/component"

type Target = DOMKeyframesDefinition
type Values = Record<string, any>
type InViewOptions = NonNullable<Parameters<typeof inView>[2]>

export interface MotionOptions {
    /**
     * Values to render on the server and before `animate` runs, or `false`
     * to render `animate` straight away.
     */
    initial?: Target | false

    /**
     * Values to animate to when the element is inserted, and whenever
     * they change on a later render.
     */
    animate?: Target

    /**
     * Values to animate to when the element is removed. Remix keeps it
     * in the DOM until the animation finishes.
     */
    exit?: Target

    /**
     * Default transition for every animation this mixin starts.
     */
    transition?: AnimationOptions

    whileHover?: Target
    whilePress?: Target
    whileInView?: Target
    inViewOptions?: InViewOptions & { once?: boolean }

    /**
     * Animate changes to this element's layout made by a render.
     */
    layout?: boolean | "position" | "size"

    /**
     * Animate between elements that share this ID as one is removed and
     * the other inserted.
     */
    layoutId?: string

    /**
     * Make the element draggable, optionally on one axis.
     */
    drag?: boolean | "x" | "y" | DragOptions
}

type Gesture = "inView" | "hover" | "press"

const gestures: [Gesture, keyof MotionOptions][] = [
    ["inView", "whileInView"],
    ["hover", "whileHover"],
    ["press", "whilePress"],
]

const firstKeyframe = (value: any) => (Array.isArray(value) ? value[0] : value)

const defaultValue = (key: string) =>
    key.startsWith("scale") || key === "opacity" ? 1 : 0

/**
 * Turn `initial` into a style object, so the server renders the element
 * where its first animation starts and it doesn't flash on hydration.
 */
function initialStyle(initial: Target) {
    const latestValues: Values = {}
    for (const key in initial) {
        if (key === "transition") continue
        latestValues[key] = firstKeyframe((initial as Values)[key])
    }

    const state = { style: {}, vars: {}, transform: {}, transformOrigin: {} }
    buildHTMLStyles(state as any, latestValues)

    return { ...state.vars, ...state.style } as Values
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

const motionMixin = createMixin<HTMLElement, [options: MotionOptions]>(
    (handle) => {
        let options: MotionOptions = {}
        let element: HTMLElement | undefined
        let scope: MotionScope | undefined
        let initialStyles: Values | undefined
        let rendered: Values = {}
        let base: Values = {}
        const active: Record<Gesture, boolean> = {
            inView: false,
            hover: false,
            press: false,
        }

        /**
         * The values this element should show now: `animate`, with any
         * active gestures layered on top in priority order.
         */
        const resolveTarget = () => {
            const target: Values = { ...(options.animate as Values) }
            for (const [gesture, prop] of gestures) {
                if (active[gesture]) Object.assign(target, options[prop])
            }
            delete target.transition
            return target
        }

        const animateTo = (target: Values, from?: Values) => {
            if (!element || !scope) return

            const changed: Values = {}
            let hasChanged = false

            for (const key in target) {
                const value = target[key]
                if (JSON.stringify(value) === JSON.stringify(rendered[key])) {
                    continue
                }
                changed[key] =
                    from && key in from && !Array.isArray(value)
                        ? [firstKeyframe(from[key]), value]
                        : value
                hasChanged = true
            }

            /**
             * Values a gesture animated that are no longer targeted
             * return to where they were before it started.
             */
            for (const key in rendered) {
                if (key in target) continue
                changed[key] = base[key] ?? defaultValue(key)
                hasChanged = true
            }

            rendered = { ...target }
            if (!hasChanged) return

            const el = element
            scope.run(() => animate(el, changed, options.transition))
        }

        const setGesture = (gesture: Gesture, isActive: boolean) => {
            if (active[gesture] === isActive) return
            active[gesture] = isActive

            /**
             * Remember the value each gesture-only key had before it was
             * first animated, so it can return there.
             */
            if (isActive && element) {
                const prop = gestures.find(([g]) => g === gesture)![1]
                const computed = getComputedStyle(element)
                for (const key in options[prop] as Values) {
                    if (key in base || key in rendered) continue
                    base[key] = transformProps.has(key)
                        ? defaultValue(key)
                        : computed.getPropertyValue(key)
                }
            }

            animateTo(resolveTarget())
        }

        handle.addEventListener("insert", ({ node }) => {
            element = node

            scope = scopeMotion(node, () => {
                const { whileHover, whilePress, whileInView } = options

                if (whileInView) {
                    const { once, ...viewOptions } = options.inViewOptions || {}
                    inView(
                        node,
                        () => {
                            setGesture("inView", true)
                            if (!once) return () => setGesture("inView", false)
                        },
                        viewOptions
                    )
                }

                if (whileHover) {
                    hover(node, () => {
                        setGesture("hover", true)
                        return () => setGesture("hover", false)
                    })
                }

                if (whilePress) {
                    press(node, () => {
                        setGesture("press", true)
                        return () => setGesture("press", false)
                    })
                }

                if (options.drag) {
                    drag(
                        node,
                        typeof options.drag === "object"
                            ? options.drag
                            : options.drag === true
                            ? {}
                            : { axis: options.drag }
                    )
                }
            })

            const { initial, animate: target } = options
            if (initial === false) {
                rendered = { ...(target as Values) }
                delete rendered.transition
                return
            }

            for (const key in initial as Values) {
                base[key] = firstKeyframe((initial as Values)[key])
            }
            animateTo(resolveTarget(), initial as Values)
        })

        handle.addEventListener("reclaimed", () => {
            rendered = {}
            animateTo(resolveTarget())
        })

        handle.addEventListener("beforeRemove", (event) => {
            const { exit, transition } = options
            if (!exit || !element || !scope) return

            const el = element
            const exitScope = scope
            event.persistNode(async (signal) => {
                const animation = exitScope.run(() =>
                    animate(el, exit as Values, transition)
                )
                signal.addEventListener("abort", () => animation.stop())
                await animation
            })
        })

        handle.addEventListener("remove", () => {
            scope?.stop()
            scope = element = undefined
            rendered = {}
        })

        handle.addEventListener("beforeUpdate", ({ node }) => {
            if (!options.layout && !options.layoutId) return
            snapshotLayout()

            const projection = visualElementStore.get(node)?.projection
            projection?.setOptions({
                transition: options.transition as any,
                animationType:
                    typeof options.layout === "string"
                        ? options.layout
                        : "both",
            })
        })

        handle.addEventListener("commit", () => layoutPass?.commit())

        return (nextOptions, props) => {
            options = nextOptions

            const { initial, layout, layoutId } = options

            /**
             * A layoutId element inserted during a layout pass animates
             * from the element it replaces, with its own transition.
             */
            if (layoutId && layoutPass && !element) {
                layoutPass.builder.shared(layoutId, options.transition || {})
            }

            if (element) {
                handle.queueTask(() => animateTo(resolveTarget()))
            }

            const patch: Values = {}

            /**
             * Keep rendering the same initial styles on later renders, so
             * Remix's per-property style diff never overwrites the values
             * Motion has animated.
             */
            if (initial && typeof props.style !== "string") {
                initialStyles ||= initialStyle(initial)
                patch.style = { ...initialStyles, ...(props.style as Values) }
            }

            if (layout) patch["data-layout"] = layout === true ? "" : layout
            if (layoutId) patch["data-layout-id"] = layoutId

            return Object.keys(patch).length
                ? createElement(handle.element, { ...props, ...patch })
                : handle.element
        }
    }
)

/**
 * Animate an element with Motion from Remix's `mix` prop.
 *
 * ```tsx
 * <li
 *     key={item.id}
 *     mix={motion({
 *         initial: { opacity: 0, y: 20 },
 *         animate: { opacity: 1, y: 0 },
 *         exit: { opacity: 0, scale: 0.8 },
 *         whileHover: { scale: 1.05 },
 *         layout: true,
 *     })}
 * />
 * ```
 *
 * `initial` is rendered on the server, `animate` runs on insert and
 * whenever it changes, and `exit` keeps the element in the DOM until it
 * finishes.
 *
 * @public
 */
export const motion = motionMixin

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
