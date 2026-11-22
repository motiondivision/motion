"use client"

import * as React from "react"
import {
    createContext,
    createElement,
    forwardRef,
    Fragment,
    useContext,
    useCallback,
    useId,
    useInsertionEffect,
    useRef,
} from "react"
import {
    appearHandoff,
    isAnimationControls,
    isControllingVariants,
    resolveVariantFromProps,
    rootProjectionNode,
} from "motion-dom"
import { warnOnce } from "motion-utils"
import {
    appearOffName,
    appearOffRule,
    createAppearAnimation,
    type AppearAnimation,
} from "../../../animation/appear/css"
import { MotionContext } from "../../../context/MotionContext"
import { useLayoutId } from "../../../motion"
import { followAppearAnimations } from "../../../animation/appear/follow"
import { registerAppearElement } from "../../../animation/appear/handoff"
import {
    MotionConfigContext,
    type Appear,
} from "../../../context/MotionConfigContext"
import { PresenceContext } from "../../../context/PresenceContext"
import { useHTMLVisualState } from "../../html/use-html-visual-state"

/**
 * React 19 moves a <style> with a precedence into the head, and keeps
 * one for each href. Before that, the rules are added when the component
 * mounts.
 */
const hoistsStyles = parseInt(React.version) > 18

let sheet: CSSStyleSheet | undefined
const inserted = new Set<string>()

function insertRules(rules: AppearAnimation["rules"]) {
    for (const name in rules) {
        if (inserted.has(name)) continue
        inserted.add(name)

        if (!sheet) {
            const style = document.createElement("style")
            document.head.appendChild(style)
            sheet = style.sheet!
        }

        sheet.insertRule(rules[name])
    }
}

const offRules = { [appearOffName]: appearOffRule }

/**
 * Someone who asks for less motion gets none of it as CSS. The animation
 * code then starts the animations, without the ones they don't want.
 */
/**
 * A browser without the properties and easing these animations are made
 * of gets none of them, rather than the parts it knows.
 */
const supportRules = {
    "m-supports": `@supports not ((translate:0) and (animation-timing-function:linear(0,1))){${appearOffRule}}`,
}

const reducedRules = {
    "m-reduced": `@media (prefers-reduced-motion:reduce){${appearOffRule}}`,
}

/**
 * The timing a component gives the components below it that take its
 * variants. Each child's delay depends on its place among them, which is
 * the order they first render in.
 */
interface Orchestration {
    delay: number
    /**
     * A child's delay after that, from its place. Nothing if it also
     * depends on how many children there are, which a render can't
     * know.
     */
    stagger: (index: number) => number | undefined
    ids: Map<string, number>
    /**
     * Why CSS can't time the children, if it can't.
     */
    off?: string
}

const OrchestrationContext = createContext<Orchestration | null>(null)

/**
 * When the last of a component's CSS animations ends, in seconds.
 */
const appearEnd = ({ timings }: AppearAnimation) =>
    Math.max(0, ...Object.values(timings).map(({ end }) => end))

const hoist = (rules: AppearAnimation["rules"]) =>
    hoistsStyles &&
    Object.keys(rules).map((name) =>
        createElement(
            "style",
            { key: name, href: name, precedence: "motion" },
            rules[name]
        )
    )

/**
 * Wrap a motion component so its enter animation runs as CSS. On a page
 * rendered on a server, that starts it before Motion's code has loaded.
 *
 * If a component has an enter animation that CSS can't run, it would
 * start later than the rest. So it turns the CSS animations of the whole
 * page off, and they all start when the code has loaded.
 */
function withAppear(Component: any, isSVG: boolean) {
    function AppearComponent(props: any, ref: React.Ref<unknown>) {
        const { isStatic, transition, reducedMotion, skipAnimations } =
            useContext(MotionConfigContext)
        const presenceContext = useContext(PresenceContext)
        const parent = useContext(MotionContext)
        const layoutId = useLayoutId(props)
        const orchestration = useContext(OrchestrationContext)
        const id = useId()
        // isSVG never changes for a component, so the hooks keep their order
        const latestValues = isSVG
            ? {}
            : useHTMLVisualState(props, isStatic).latestValues

        /**
         * The animation is made once, from the props the component
         * mounts with.
         */
        const ref_ = useRef<AppearAnimation | string | null>()
        const children = useRef<Orchestration | null>(null)
        if (ref_.current === undefined) {
            const { variants } = props
            let { animate, initial } = props
            let delay = 0
            let reason: string | undefined

            /**
             * A component that takes its parent's variants animates
             * when its parent says, after a delay the parent sets.
             */
            if (
                !isControllingVariants(props) &&
                variants &&
                props.inherit !== false &&
                parent.animate !== undefined
            ) {
                animate = parent.animate
                initial ??= parent.initial

                /**
                 * Under a parent that's already there, it animates by
                 * itself as it mounts.
                 */
                if (orchestration && !parent.visualElement?.current) {
                    const { ids } = orchestration
                    ids.has(id) || ids.set(id, ids.size)
                    const stagger = orchestration.stagger(ids.get(id)!)
                    delay = orchestration.delay + (stagger || 0)
                    reason =
                        orchestration.off ||
                        (stagger === undefined
                            ? "a stagger that needs the number of children"
                            : undefined)
                }
            }

            const appearProps = { ...props, animate, initial }
            const hasEnter =
                initial !== false && presenceContext?.initial !== false

            /**
             * The timing this component gives the components that take
             * its variants.
             */
            const label = Array.isArray(animate)
                ? animate[animate.length - 1]
                : animate
            const isVariantNode =
                hasEnter &&
                typeof label === "string" &&
                (variants || isControllingVariants(props))
            const {
                delayChildren = 0,
                staggerChildren = 0,
                staggerDirection = 1,
                when,
            } = ((isVariantNode &&
                ((resolveVariantFromProps(appearProps, label) as any)
                    ?.transition ??
                    props.transition ??
                    transition)) ||
                {}) as any

            if (when === "afterChildren") reason ||= 'when: "afterChildren"'

            const isSkipped =
                isStatic ||
                skipAnimations ||
                reducedMotion === "always" ||
                /**
                 * An element that takes over a layoutId has no enter
                 * animation.
                 */
                rootProjectionNode.current?.sharedNodes.get(layoutId!)?.lead

            ref_.current = isSkipped
                ? null
                : isSVG
                ? (hasEnter &&
                      animate &&
                      !isAnimationControls(animate) &&
                      "an SVG element") ||
                  null
                : createAppearAnimation(
                      appearProps,
                      latestValues,
                      presenceContext,
                      transition,
                      delay
                  ) || null

            const made = ref_.current
            if (made && typeof made !== "string") {
                Object.assign(
                    made.rules,
                    supportRules,
                    reducedMotion === "user" && reducedRules
                )

                /**
                 * Its parent's timing is one CSS can't follow, so its
                 * own animation waits.
                 */
                if (reason) ref_.current = reason
            }

            if (isVariantNode && !isSkipped) {
                children.current = {
                    delay:
                        (when === "beforeChildren"
                            ? made && typeof made !== "string"
                                ? appearEnd(made)
                                : 0
                            : delay) +
                        (typeof delayChildren === "number" ? delayChildren : 0),
                    stagger:
                        typeof delayChildren === "function"
                            ? (index) => {
                                  /**
                                   * The same delay for two numbers of
                                   * children is one that doesn't depend
                                   * on the number. stagger() keeps what
                                   * it works out for each number, so
                                   * few are asked for.
                                   */
                                  const total =
                                      2 ** Math.ceil(Math.log2(index + 2))
                                  const stagger = delayChildren(index, total)
                                  return stagger ===
                                      delayChildren(index, total * 2)
                                      ? stagger
                                      : undefined
                              }
                            : (index) =>
                                  staggerDirection === 1 || !staggerChildren
                                      ? index * staggerChildren
                                      : undefined,
                    ids: new Map(),
                    off:
                        typeof ref_.current === "string"
                            ? ref_.current
                            : undefined,
                }
            }
        }
        const isOff = typeof ref_.current === "string"
        const appear = ref_.current as AppearAnimation | null

        if (isOff && process.env.NODE_ENV !== "production") {
            warnOnce(
                false,
                `An enter animation of ${ref_.current} can't run as CSS, so the enter animations of this page wait for Motion's animation code.`
            )
        }

        /**
         * The element is known to the animation code by itself, from
         * the first time it's in the document.
         */
        const isRegistered = useRef(false)
        const setRef = useCallback(
            (element: HTMLElement | null) => {
                if (element && appear && !isOff && !isRegistered.current) {
                    isRegistered.current = true
                    registerAppearElement(element, appear)
                }

                typeof ref === "function"
                    ? ref(element)
                    : ref && ((ref as any).current = element)
            },
            [ref, appear]
        )

        useInsertionEffect(() => {
            appear &&
                !hoistsStyles &&
                insertRules(isOff ? offRules : appear.rules)
        }, [])

        const provide = (element: React.ReactElement) =>
            children.current ? (
                <OrchestrationContext.Provider value={children.current}>
                    {element}
                </OrchestrationContext.Provider>
            ) : (
                element
            )

        if (!appear) return provide(<Component {...props} ref={ref} />)

        if (isOff) {
            return provide(
                <Fragment>
                    {hoist(offRules)}
                    <Component {...props} ref={ref} />
                </Fragment>
            )
        }

        return provide(
            <Fragment>
                {hoist(appear.rules)}
                <Component
                    {...props}
                    ref={setRef}
                    style={{
                        ...appear.values,
                        ...props.style,
                        ...appear.style,
                    }}
                />
            </Fragment>
        )
    }

    return forwardRef(AppearComponent)
}

const wrapped = new WeakMap<object, any>()

/**
 * Pass to `MotionConfig` to run the enter animations of the motion
 * components below it as CSS.
 */
export const appear: Appear = (Component, isSVG) => {
    appearHandoff.current || followAppearAnimations()
    wrapped.has(Component) ||
        wrapped.set(Component, withAppear(Component, isSVG))

    return wrapped.get(Component)
}
