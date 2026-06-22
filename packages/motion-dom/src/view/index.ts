import { noop } from "motion-utils"
import type { GroupAnimation } from "../animation/GroupAnimation"
import { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"
import { addToQueue } from "./queue"
import {
    ViewTransitionOptions,
    ViewTransitionTarget,
    ViewTransitionTargetDefinition,
} from "./types"
import "./types.global"

export class ViewTransitionBuilder {
    private currentSubject: ViewTransitionTargetDefinition = "root"

    targets = new Map<ViewTransitionTargetDefinition, ViewTransitionTarget>()

    /**
     * Definitions that must be resolved to elements (and assigned a
     * `view-transition-name`) rather than treated as pre-named layers.
     */
    resolveDefs = new Set<ViewTransitionTargetDefinition>()

    /**
     * When set, the transition is scoped to this element (via
     * `element.startViewTransition`) and selectors resolve within it.
     */
    scope?: Element

    update: () => void | Promise<void>

    options: ViewTransitionOptions

    notifyReady: (value: GroupAnimation) => void = noop

    private readyPromise = new Promise<GroupAnimation>((resolve) => {
        this.notifyReady = resolve
    })

    constructor(
        update: () => void | Promise<void>,
        options: ViewTransitionOptions = {},
        scope?: Element
    ) {
        this.update = update
        this.scope = scope
        this.options = {
            interrupt: "wait",
            ...options,
        }
        addToQueue(this)
    }

    get(subject: ViewTransitionTargetDefinition) {
        this.currentSubject = subject
        if (subject instanceof Element) this.resolveDefs.add(subject)

        return this
    }

    /**
     * Target elements resolved from a selector or Element. Each resolved
     * element is assigned a `view-transition-name` automatically.
     */
    add(subject: ViewTransitionTargetDefinition) {
        this.currentSubject = subject
        this.resolveDefs.add(subject)
        // Register the subject so it participates (and gets an automatic
        // layout/morph animation) even without an explicit enter/exit/layout.
        if (!this.targets.has(subject)) this.targets.set(subject, {})

        return this
    }

    /**
     * Target a layer by its existing `view-transition-name`.
     */
    addName(name: string) {
        this.currentSubject = name
        this.resolveDefs.delete(name)
        if (!this.targets.has(name)) this.targets.set(name, {})

        return this
    }

    layout(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("layout", keyframes, options)

        return this
    }

    new(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("new", keyframes, options)

        return this
    }

    old(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("old", keyframes, options)

        return this
    }

    enter(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("enter", keyframes, options)

        return this
    }

    exit(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("exit", keyframes, options)

        return this
    }

    crossfade(options?: AnimationOptions) {
        this.updateTarget("enter", { opacity: 1 }, options)
        this.updateTarget("exit", { opacity: 0 }, options)

        return this
    }

    updateTarget(
        target: "enter" | "exit" | "layout" | "new" | "old",
        keyframes: DOMKeyframesDefinition,
        options: AnimationOptions = {}
    ) {
        const { currentSubject, targets } = this

        if (!targets.has(currentSubject)) {
            targets.set(currentSubject, {})
        }

        const targetData = targets.get(currentSubject)!

        targetData[target] = { keyframes, options }
    }

    then(resolve: () => void, reject?: () => void) {
        return this.readyPromise.then(resolve, reject)
    }
}

export function animateView(
    update: () => void | Promise<void>,
    options?: ViewTransitionOptions
): ViewTransitionBuilder
export function animateView(
    scope: Element,
    update: () => void | Promise<void>,
    options?: ViewTransitionOptions
): ViewTransitionBuilder
export function animateView(
    a: Element | (() => void | Promise<void>),
    b?: ViewTransitionOptions | (() => void | Promise<void>),
    c: ViewTransitionOptions = {}
) {
    return a instanceof Element
        ? new ViewTransitionBuilder(b as () => void | Promise<void>, c, a)
        : new ViewTransitionBuilder(a, (b as ViewTransitionOptions) ?? {})
}
