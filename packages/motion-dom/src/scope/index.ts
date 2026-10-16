import { removeItem } from "motion-utils"
import { releaseElement } from "../animation/animate/element"
import type { AnimationOptions } from "../animation/types"
import { ElementOrSelector, resolveElements } from "../utils/resolve-elements"
import { activeScope, ActiveScope, addToScope } from "./active"
import { toMediaQuery } from "./media"

/**
 * A media query or shorthand (see `toMediaQuery`), or named conditions.
 * With named conditions, setup runs when any of them match, and their
 * state is available as `scope.media`.
 */
export type MediaConditions = string | Record<string, string>

export interface ScopeOptions {
    /**
     * Default transition for every `animate()` call made in this scope.
     */
    transition?: AnimationOptions

    /**
     * Only run setup while these conditions match. When they change, the
     * scope is cancelled and setup runs again.
     */
    matchMedia?: MediaConditions
}

export type ScopeState = "active" | "stopped" | "cancelled"

export interface MotionScope {
    /**
     * `"active"` until `stop()` or `cancel()` is called. Lets async work
     * check whether its scope has gone before it starts animating.
     */
    state: ScopeState

    /**
     * Whether each named `matchMedia` condition matched when setup last ran.
     */
    media: Record<string, boolean>

    /**
     * Run `callback` in this scope, so animations, scroll and view
     * listeners and gestures it starts are collected.
     */
    run<R>(callback: () => R): R

    /**
     * Return a function that runs `callback` in this scope, for instance
     * as an event handler.
     */
    bind<F extends (...args: any[]) => any>(callback: F): F

    /**
     * Run `callback` outside of any scope, so what it starts is not
     * collected and survives this scope being stopped or cancelled.
     */
    ignore<R>(callback: () => R): R

    /**
     * Stop everything in this scope and remove its media listeners.
     * Styles are left as they are.
     */
    stop(): void

    /**
     * As `stop()`, and restore the inline styles of every element
     * animated in this scope to what they were before.
     */
    cancel(): void

    /**
     * Cancel, then run setup again if the media conditions match.
     */
    refresh(): void
}

export type ScopeSetup = (scope: MotionScope) => void | VoidFunction

/**
 * Create a scope that collects the animations, scroll and view
 * listeners, gestures and resize observers started inside it, so they
 * can be stopped or cancelled together.
 *
 * An optional root element or selector comes first. Selectors used
 * inside the scope resolve within it.
 *
 * ```js
 * const scope = scopeMotion(
 *     ".list",
 *     ({ media }) => {
 *         animate("li", { x: media.desktop ? 100 : 0 })
 *     },
 *     { transition: { duration: 0.5 }, matchMedia: { desktop: ">=800" } }
 * )
 * ```
 *
 * @public
 */
export function scopeMotion(
    setup?: ScopeSetup,
    options?: ScopeOptions
): MotionScope
export function scopeMotion(
    root: ElementOrSelector,
    setup?: ScopeSetup,
    options?: ScopeOptions
): MotionScope
export function scopeMotion(...args: [any?, any?, any?]): MotionScope {
    const root: ElementOrSelector =
        typeof args[0] === "function" ? undefined : args.shift()
    const [setup, options = {}] = args as [ScopeSetup?, ScopeOptions?]

    const { transition, matchMedia } = options
    const queries: [string, MediaQueryList][] = []
    const styles = new Map<Element, string | null>()
    let cleanups: VoidFunction[] = []
    let isPending = false

    const active: ActiveScope = {
        root: resolveElements(root)[0],
        transition,
        add(cleanup) {
            cleanups.push(cleanup)
            return () => removeItem(cleanups, cleanup)
        },
        bind: (callback) =>
            ((...args: any[]) => {
                const result = scope.run(() => callback(...args))
                return typeof result === "function"
                    ? active.bind(result)
                    : result
            }) as typeof callback,
        track(element) {
            styles.has(element) ||
                styles.set(element, element.getAttribute("style"))
        },
    }

    const clear = (restore?: boolean) => {
        const current = cleanups
        cleanups = []
        for (let i = current.length - 1; i >= 0; i--) current[i]()

        restore &&
            styles.forEach((style, element) => {
                releaseElement(element)
                style === null
                    ? element.removeAttribute("style")
                    : element.setAttribute("style", style)
            })
        styles.clear()
    }

    const start = () => {
        scope.state = "active"
        let matches = !queries.length
        scope.media = {}

        for (const [name, query] of queries) {
            matches = (scope.media[name] = query.matches) || matches
        }

        if (matches && setup) {
            const cleanup = scope.run(() => setup(scope))
            typeof cleanup === "function" && active.add(cleanup)
        }
    }

    const onChange = () => {
        if (isPending) return
        isPending = true

        /**
         * Several conditions can change together, for instance two
         * breakpoints crossed by one resize. Refresh once.
         */
        queueMicrotask(() => {
            isPending = false
            queries.length && scope.refresh()
        })
    }

    const kill = (restore?: boolean) => {
        scope.state = restore ? "cancelled" : "stopped"
        for (const [, query] of queries) {
            query.removeEventListener("change", onChange)
        }
        queries.length = 0
        clear(restore)
    }

    const runIn = <R>(target: ActiveScope | undefined, callback: () => R) => {
        const prev = activeScope.current
        activeScope.current = target
        try {
            return callback()
        } finally {
            activeScope.current = prev
        }
    }

    const scope: MotionScope = {
        state: "active",
        media: {},
        run: (callback) => runIn(active, callback),
        ignore: (callback) => runIn(undefined, callback),
        bind: active.bind,
        stop: () => kill(),
        cancel: () => kill(true),
        refresh() {
            clear(true)
            start()
        },
    }

    if (matchMedia && typeof window !== "undefined") {
        const conditions =
            typeof matchMedia === "string"
                ? { matches: matchMedia }
                : matchMedia

        for (const name in conditions) {
            const query = window.matchMedia(toMediaQuery(conditions[name]))
            query.addEventListener("change", onChange)
            queries.push([name, query])
        }
    }

    /**
     * A scope created inside another is cancelled with it.
     */
    addToScope(scope.cancel)

    start()

    return scope
}
