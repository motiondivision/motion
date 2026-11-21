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
import {
    appearRule,
    createAppearAnimation,
    hasAnimationFeature,
    type AppearAnimation,
} from "../../../animation/appear/css"
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

function insertRules(properties: AppearAnimation["properties"]) {
    for (const name in properties) {
        if (inserted.has(name)) continue
        inserted.add(name)

        if (!sheet) {
            const style = document.createElement("style")
            document.head.appendChild(style)
            sheet = style.sheet!
        }

        sheet.insertRule(appearRule(properties[name]))
    }
}

/**
 * Wrap a motion component that fetches its animation code, so its enter
 * animation runs as CSS until it arrives.
 */
function withAppear(Component: any, isSVG: boolean) {
    if (isSVG) return Component

    function AppearComponent(props: any, ref: React.Ref<unknown>) {
        const { isStatic, transition } = useContext(MotionConfigContext)
        const presenceContext = useContext(PresenceContext)
        const { latestValues } = useHTMLVisualState(props, isStatic)

        /**
         * The animation is made once, from the props the component
         * mounts with.
         */
        const ref_ = useRef<AppearAnimation | null>()
        if (ref_.current === undefined) {
            ref_.current =
                (!isStatic &&
                    !hasAnimationFeature() &&
                    createAppearAnimation(
                        props,
                        latestValues,
                        presenceContext,
                        transition
                    )) ||
                null
        }
        const appear = ref_.current

        /**
         * The element is known to the animation code by itself, from
         * the first time it's in the document.
         */
        const isRegistered = useRef(false)
        const setRef = useCallback(
            (element: HTMLElement | null) => {
                if (element && appear && !isRegistered.current) {
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
            appear && !hoistsStyles && insertRules(appear.properties)
        }, [])

        if (!appear) return <Component {...props} ref={ref} />

        return (
            <Fragment>
                {hoistsStyles &&
                    Object.keys(appear.properties).map((name) =>
                        createElement(
                            "style",
                            { key: name, href: name, precedence: "motion" },
                            appearRule(appear.properties[name])
                        )
                    )}
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
            options?.type
                ? options.type === "svg"
                : isSVGComponent(Component)
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
