"use client"

import * as React from "react"
import {
    createElement,
    forwardRef,
    Fragment,
    useContext,
    useId,
    useInsertionEffect,
    useRef,
} from "react"
import {
    appearRule,
    createAppearAnimation,
    hasAnimationFeature,
    type AppearAnimation,
} from "../../../animation/appear/css"
import { registerAppearAnimation } from "../../../animation/appear/handoff"
import { MotionConfigContext } from "../../../context/MotionConfigContext"
import { PresenceContext } from "../../../context/PresenceContext"
import { isSVGComponent } from "../../dom/utils/is-svg-component"
import { useHTMLVisualState } from "../../html/use-html-visual-state"
import { m } from "../m/proxy"

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
 * Wrap a motion component that gets its features from `LazyMotion`, so
 * its enter animation runs as CSS until they arrive.
 */
function withAppear(Component: any, isSVG: boolean) {
    if (isSVG) return Component

    function AppearComponent(props: any, ref: React.Ref<unknown>) {
        const id = useId()
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

            ref_.current &&
                typeof window !== "undefined" &&
                registerAppearAnimation(id)
        }
        const appear = ref_.current

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
                    ref={ref}
                    data-framer-appear-id={id}
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

const cache = new Map<string, any>()

/**
 * `m` components whose enter animations start as CSS.
 */
export const motion = /*@__PURE__*/ new Proxy(
    { create: (Component: any, options?: any) =>
            withAppear(
                m.create(Component, options),
                options?.type ? options.type === "svg" : isSVGComponent(Component)
            ) } as any,
    {
        get: (target, key: string) => {
            if (key === "create") return target.create
            if (!cache.has(key)) {
                cache.set(key, withAppear((m as any)[key], isSVGComponent(key)))
            }
            return cache.get(key)
        },
    }
) as typeof m
