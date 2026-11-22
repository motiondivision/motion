"use client"

import * as React from "react"
import {
    createElement,
    forwardRef,
    Fragment,
    useContext,
    useCallback,
    useInsertionEffect,
    useRef,
} from "react"
import { isAnimationControls, rootProjectionNode } from "motion-dom"
import { warnOnce } from "motion-utils"
import {
    appearOffName,
    appearOffRule,
    createAppearAnimation,
    hasAnimationFeature,
    type AppearAnimation,
} from "../../../animation/appear/css"
import { MotionContext } from "../../../context/MotionContext"
import { useLayoutId } from "../../../motion"
import { registerAppearElement } from "../../../animation/appear/handoff"
import { MotionConfigContext } from "../../../context/MotionConfigContext"
import { PresenceContext } from "../../../context/PresenceContext"
import { isSVGComponent } from "../../dom/utils/is-svg-component"
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
 * Wrap a motion component that fetches its animation code, so its enter
 * animation runs as CSS until it arrives.
 *
 * If a component has an enter animation that CSS can't run, it would
 * start later than the rest. So it turns the CSS animations of the whole
 * page off, and they all start when the animation code arrives.
 */
function withAppear(Component: any, isSVG: boolean) {
    function AppearComponent(props: any, ref: React.Ref<unknown>) {
        const { isStatic, transition } = useContext(MotionConfigContext)
        const presenceContext = useContext(PresenceContext)
        const parent = useContext(MotionContext)
        const layoutId = useLayoutId(props)
        // isSVG never changes for a component, so the hooks keep their order
        const latestValues = isSVG
            ? {}
            : useHTMLVisualState(props, isStatic).latestValues

        /**
         * The animation is made once, from the props the component
         * mounts with.
         */
        const ref_ = useRef<AppearAnimation | string | null>()
        if (ref_.current === undefined) {
            const { animate, initial, variants } = props
            const hasEnter =
                initial !== false && presenceContext?.initial !== false

            ref_.current =
                isStatic ||
                hasAnimationFeature() ||
                /**
                 * An element that takes over a layoutId has no enter
                 * animation.
                 */
                rootProjectionNode.current?.sharedNodes.get(layoutId!)?.lead
                    ? null
                    : isSVG
                    ? (hasEnter &&
                          animate &&
                          !isAnimationControls(animate) &&
                          "an SVG element") ||
                      null
                    : /**
                     * A component that takes its parent's variants
                     * animates when its parent says.
                     */
                    hasEnter &&
                      animate === undefined &&
                      variants &&
                      typeof parent.animate === "string" &&
                      parent.animate !== parent.initial
                    ? "variants from a parent"
                    : createAppearAnimation(
                          props,
                          latestValues,
                          presenceContext,
                          transition
                      ) || null
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

        if (!appear) return <Component {...props} ref={ref} />

        if (isOff) {
            return (
                <Fragment>
                    {hoist(offRules)}
                    <Component {...props} ref={ref} />
                </Fragment>
            )
        }

        return (
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

/**
 * Motion components whose enter animations start as CSS, from components
 * that get their animation code after they mount.
 */
export function createAppearProxy<T extends object>(base: T): T {
    const cache = new Map<string, any>()
    const create = (Component: any, options?: any) =>
        withAppear(
            (base as any).create(Component, options),
            options?.type ? options.type === "svg" : isSVGComponent(Component)
        )

    return new Proxy({} as T, {
        get: (_, key: string) => {
            if (key === "create") return create
            if (!cache.has(key)) {
                cache.set(
                    key,
                    withAppear((base as any)[key], isSVGComponent(key))
                )
            }
            return cache.get(key)
        },
    })
}
