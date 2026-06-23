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
     * Subjects opted out of the default crop (clip + object-fit: cover +
     * animated corner radii) via `.crop(false)`.
     */
    noCrop = new Set<ViewTransitionTargetDefinition>()

    /**
     * Subjects paired with a different new-snapshot target (the second `.add()`
     * argument), so two distinct elements share one name and morph into each
     * other - a shared-element transition.
     */
    pairs = new Map<
        ViewTransitionTargetDefinition,
        ViewTransitionTargetDefinition
    >()

    /**
     * A `view-transition-class` to apply to each subject's resolved elements,
     * so authors can target the generated layers from CSS by class rather than
     * the opaque generated name.
     */
    classNames = new Map<ViewTransitionTargetDefinition, string>()

    update: () => void | Promise<void>

    options: ViewTransitionOptions

    notifyReady: (value: GroupAnimation) => void = noop

    notifyReject: (error: unknown) => void = noop

    private readyPromise = new Promise<GroupAnimation>((resolve, reject) => {
        this.notifyReady = resolve
        this.notifyReject = reject
    })

    constructor(
        update: () => void | Promise<void>,
        options: ViewTransitionOptions = {}
    ) {
        this.update = update
        this.options = {
            interrupt: "wait",
            ...options,
        }
        // Avoid an unhandled rejection when a failed transition has no
        // `.then(_, reject)` handler attached (e.g. fire-and-forget).
        this.readyPromise.catch(noop)
        addToQueue(this)
    }

    /**
     * Target elements resolved from a selector or Element, each assigned a
     * `view-transition-name` automatically.
     *
     * Passing a second target pairs them: the first is resolved in the old
     * snapshot and the second in the new, sharing one name so two *different*
     * elements morph into each other (e.g. `.add(card, ".modal")`). Symmetric -
     * pass them the other way round to morph back.
     */
    add(
        subject: ViewTransitionTargetDefinition,
        newSubject?: ViewTransitionTargetDefinition
    ) {
        this.currentSubject = subject
        this.resolveDefs.add(subject)
        if (newSubject !== undefined) this.pairs.set(subject, newSubject)
        // Register the subject so it participates (and gets an automatic
        // layout/morph animation) even without an explicit enter/exit/layout.
        if (!this.targets.has(subject)) this.targets.set(subject, {})

        return this
    }

    /**
     * Morphs are clipped + `object-fit: cover` (and their corners animate)
     * by default. Call `.crop(false)` to opt this subject out and fall back
     * to the browser default (which overflows on aspect-ratio change).
     */
    crop(enabled = true) {
        enabled
            ? this.noCrop.delete(this.currentSubject)
            : this.noCrop.add(this.currentSubject)

        return this
    }

    /**
     * Tag this subject's generated layers with a `view-transition-class`, so
     * they can be targeted from CSS - `::view-transition-group(.name)`,
     * `::view-transition-old/new(.name)`, `::view-transition-image-pair(.name)`
     * - without the opaque generated `view-transition-name`. Because `.add()`
     * can match many elements, a shared class targets them all at once (and,
     * for a pair, both ends). The escape hatch for z-index / custom keyframes
     * on a morph layer.
     */
    class(name: string) {
        this.classNames.set(this.currentSubject, name)

        return this
    }

    /**
     * Set the transition for this subject's morph. The morph is enabled
     * automatically by `.add()`; this just customises its timing (duration,
     * easing, a `delay`/`stagger`, …). On the implicit `root` subject it also
     * opts the page into the transition (the root crossfade).
     */
    layout(options: AnimationOptions = {}) {
        this.updateTarget("layout", {}, options)

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

    /**
     * Animate the new view directly, whether the element is appearing or
     * persisting (unlike `.enter()`, which only fires for a pure newcomer).
     * Pair with `.old()` for a crossfade or slide-through.
     */
    new(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("new", keyframes, options)

        return this
    }

    /**
     * Animate the old view directly, whether the element is leaving or
     * persisting (unlike `.exit()`, which only fires for a pure leaver).
     */
    old(keyframes: DOMKeyframesDefinition, options?: AnimationOptions) {
        this.updateTarget("old", keyframes, options)

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
    options: ViewTransitionOptions = {}
) {
    return new ViewTransitionBuilder(update, options)
}
