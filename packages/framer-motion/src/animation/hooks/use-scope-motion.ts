"use client"

import { scopeMotion } from "motion-dom"
import type { MotionScope, ScopeOptions, ScopeSetup } from "motion-dom"
import { DependencyList, RefObject, useContext, useRef } from "react"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { useReducedMotionConfig } from "../../utils/reduced-motion/use-reduced-motion-config"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"

export interface UseScopeMotionOptions extends ScopeOptions {
    /**
     * Cancel the scope and run setup again when any of these change.
     */
    deps?: DependencyList
}

/**
 * Run `setup` in a `scopeMotion()` scope rooted at `ref`, so selectors
 * resolve inside it. The scope is cancelled on unmount, or when `deps`
 * change, which stops everything started in it and restores inline styles.
 *
 * ```jsx
 * const ref = useRef(null)
 * useScopeMotion(ref, () => {
 *     inView("li", (el) => animate(el, { opacity: 1 }))
 *     timeline([["h1", { opacity: 1 }], ["p", { y: 0 }]])
 * })
 * return <ul ref={ref}>...</ul>
 * ```
 *
 * Animations and timelines started in it follow `MotionConfig`'s
 * `reducedMotion` and `skipAnimations`, unless `transition` sets them.
 *
 * Returns a ref to the current scope, for `run()` and `bind()` in event
 * handlers.
 *
 * @public
 */
export function useScopeMotion(
    ref: RefObject<Element | null> | null | undefined,
    setup: ScopeSetup,
    { deps = [], ...options }: UseScopeMotionOptions = {}
): RefObject<MotionScope | null> {
    const scope = useRef<MotionScope | null>(null)
    const latestSetup = useRef(setup)
    latestSetup.current = setup

    const reduceMotion = useReducedMotionConfig()
    const { skipAnimations } = useContext(MotionConfigContext)

    useIsomorphicLayoutEffect(() => {
        const current = (scope.current = scopeMotion(
            ref?.current || undefined,
            (s) => latestSetup.current(s),
            {
                ...options,
                /**
                 * Only pass them on when set, so they don't override
                 * a motion component's own MotionConfig or a scoped
                 * animate()'s settings.
                 */
                transition: {
                    ...(reduceMotion && { reduceMotion }),
                    ...(skipAnimations && { skipAnimations }),
                    ...options.transition,
                },
            }
        ))

        return () => {
            current.cancel()
            if (scope.current === current) scope.current = null
        }
    }, deps)

    return scope
}
