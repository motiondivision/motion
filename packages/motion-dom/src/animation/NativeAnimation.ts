import {
    invariant,
    millisecondsToSeconds,
    noop,
    secondsToMilliseconds,
} from "motion-utils"
import { style } from "../render/dom/style"
import { getFinalKeyframe } from "./keyframes/get-final"
import { hydrateKeyframes } from "./keyframes/hydrate"
import {
    AnimationPlaybackControls,
    DOMValueAnimationOptions,
    ProgressTimeline,
} from "./types"
import { startWaapiAnimation } from "./waapi/start-waapi-animation"
import { applyGeneratorOptions } from "./waapi/utils/apply-generator"

const animationMaps = new WeakMap<Element, Map<string, NativeAnimation>>()
const animationMapKey = (name: string, pseudoElement: string) =>
    `${name}:${pseudoElement}`

function getAnimationMap(element: Element) {
    const map = animationMaps.get(element) || new Map()
    animationMaps.set(element, map)

    return map
}

export interface NativeAnimationOptions<V extends string | number = number>
    extends DOMValueAnimationOptions<V> {
    pseudoElement?: string
}

export interface NativeControlsOptions {
    animation: Animation
}

/**
 * NativeAnimation implements AnimationPlaybackControls for the browser's Web Animations API.
 */
export class NativeAnimation implements AnimationPlaybackControls {
    /**
     * The interfaced Web Animation API animation
     */
    private animation: Animation

    private allowFlatten: boolean

    private removeAnimation: VoidFunction

    private isPseudoElement: boolean

    constructor(options: NativeAnimationOptions | NativeControlsOptions) {
        /**
         * If we already have an animation, we don't need to instantiate one
         * and can just use this as a controls interface.
         */
        if ("animation" in options) {
            this.animation = options.animation
            return
        }

        const {
            element,
            name,
            keyframes: unresolvedKeyframes,
            pseudoElement,
            allowFlatten = false,
        } = options
        let { transition } = options

        this.isPseudoElement = Boolean(pseudoElement)

        this.allowFlatten = allowFlatten

        /**
         * Stop any existing animations on the element before reading existing keyframes.
         *
         * TODO: Check for VisualElement before using animation state. This is a fallback
         * for mini animate(). Do this when implementing NativeAnimationExtended.
         */
        const animationMap = getAnimationMap(element)
        const key = animationMapKey(name, pseudoElement || "")
        const currentAnimation = animationMap.get(key)
        currentAnimation && currentAnimation.stop()

        /**
         * TODO: If these keyframes aren't correctly hydrated then we want to throw
         * run an instant animation.
         */

        const keyframes = hydrateKeyframes(
            element,
            name,
            unresolvedKeyframes,
            pseudoElement
        )

        invariant(
            typeof transition.type !== "string",
            `animateMini doesn't support "type" as a string. Did you mean to import { spring } from "motion"?`
        )
        transition = applyGeneratorOptions(transition)

        this.animation = startWaapiAnimation(
            element,
            name,
            keyframes,
            transition,
            pseudoElement
        )

        if (transition.autoplay === false) {
            this.animation.pause()
        }

        this.removeAnimation = () => animationMap.delete(key)

        this.animation.onfinish = () => {
            if (!pseudoElement) {
                style.set(
                    element,
                    name,
                    getFinalKeyframe(keyframes, transition)
                )
                this.cancel()
            }
        }

        /**
         * TODO: Check for VisualElement before using animation state.
         */
        animationMap.set(key, this)
    }

    play() {
        this.animation.play()
    }

    pause() {
        this.animation.pause()
    }

    complete() {
        this.animation.finish()
    }

    cancel() {
        try {
            this.animation.cancel()
        } catch (e) {}

        this.removeAnimation()
    }

    stop() {
        const { state } = this

        if (state === "idle" || state === "finished") {
            return
        }

        this.commitStyles()
        this.cancel()
    }

    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * In this method, we commit styles back to the DOM before cancelling
     * the animation.
     *
     * This is designed to be overridden by NativeAnimationExtended, which
     * will create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to also correctly calculate velocity for any subsequent animation
     * while deferring the commit until the next animation frame.
     */
    private commitStyles() {
        if (!this.isPseudoElement) {
            this.animation.commitStyles?.()
        }
    }

    get duration() {
        const duration =
            this.animation.effect?.getComputedTiming().duration || 0

        return millisecondsToSeconds(Number(duration))
    }

    get time() {
        return millisecondsToSeconds(Number(this.animation.currentTime) || 0)
    }

    set time(newTime: number) {
        this.animation.currentTime = secondsToMilliseconds(newTime)
    }

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed() {
        return this.animation.playbackRate
    }

    set speed(newSpeed: number) {
        this.animation.playbackRate = newSpeed
    }

    get state() {
        return this.animation.playState
    }

    get startTime() {
        return Number(this.animation.startTime)
    }

    get finished() {
        return this.animation.finished
    }

    flatten() {
        if (this.allowFlatten) {
            this.animation.effect?.updateTiming({ easing: "linear" })
        }
    }

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline(timeline: ProgressTimeline): VoidFunction {
        this.animation.timeline = timeline as any
        this.animation.onfinish = null

        return noop<void>
    }

    /**
     * Allows the animation to be awaited.
     *
     * @deprecated Use `finished` instead.
     */
    then(onResolve: VoidFunction, onReject?: VoidFunction): Promise<void> {
        return this.finished.then(onResolve).catch(onReject)
    }
}
