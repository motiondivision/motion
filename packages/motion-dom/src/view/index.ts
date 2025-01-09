import { noop } from "motion-utils"
import type { BaseGroupPlaybackControls } from "../animation/controls/BaseGroup"
import { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"
import { startViewAnimation } from "./start"
import { Target, ViewTransitionOptions, ViewTransitionTarget } from "./types"
import "./types.global"

/**
 * TODO:
 * - Create view transition on next tick
 * - Replace animations with Motion animations
 * - Return GroupAnimation on next tick
 */
export class ViewTransitionBuilder {
    private currentTarget: Target = "root"

    private targets = new Map<Target, ViewTransitionTarget>()

    private notifyReady: (value: BaseGroupPlaybackControls) => void = noop

    private readyPromise = new Promise<BaseGroupPlaybackControls>((resolve) => {
        this.notifyReady = resolve
    })

    constructor(
        update: () => void | Promise<void>,
        options: ViewTransitionOptions = {}
    ) {
        queueMicrotask(() => {
            startViewAnimation(update, options, this.targets).then(
                (animation) => this.notifyReady(animation)
            )
        })
    }

    get(selector: Target) {
        this.currentTarget = selector

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
        const { currentTarget, targets } = this

        if (!targets.has(currentTarget)) {
            targets.set(currentTarget, {})
        }

        const targetData = targets.get(currentTarget)!

        targetData[target] = { keyframes, options }
    }

    then(resolve: () => void, reject?: () => void) {
        return this.readyPromise.then(resolve, reject)
    }
}

export function view(
    update: () => void | Promise<void>,
    defaultOptions: ViewTransitionOptions = {}
) {
    return new ViewTransitionBuilder(update, defaultOptions)
}
