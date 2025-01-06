import {
    AnimationPlaybackControls,
    createGeneratorEasing,
    isGenerator,
    NativeAnimationControls,
    supportsLinearEasing,
    UnresolvedValueKeyframe,
    ValueAnimationOptions,
    ValueKeyframe,
    ValueKeyframesDefinition,
} from "motion-dom"
import { invariant, secondsToMilliseconds } from "motion-utils"
import { startWaapiAnimation } from "."
import { browserNumberValueTypes } from "../../../render/dom/value-types/number-browser"
import { getFinalKeyframe } from "./utils/get-final-keyframe"
import { setCSSVar, setStyle } from "./utils/style"
import { supportsPartialKeyframes } from "./utils/supports-partial-keyframes"
import { supportsWaapi } from "./utils/supports-waapi"

const state = new WeakMap<Element, Map<string, NativeAnimation>>()

function hydrateKeyframes(
    valueName: string,
    keyframes: ValueKeyframe[] | UnresolvedValueKeyframe[],
    read: () => ValueKeyframe
) {
    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i] === null) {
            keyframes[i] = i === 0 ? read() : keyframes[i - 1]
        }

        if (
            typeof keyframes[i] === "number" &&
            browserNumberValueTypes[valueName]
        ) {
            keyframes[i] = browserNumberValueTypes[valueName].transform!(
                keyframes[i]
            )
        }
    }

    if (!supportsPartialKeyframes() && keyframes.length < 2) {
        keyframes.unshift(read())
    }
}

const defaultEasing = "easeOut"

function getElementAnimationState(element: Element) {
    const animationState =
        state.get(element) || new Map<string, NativeAnimation>()
    state.set(element, animationState)
    return state.get(element)!
}

export class NativeAnimation
    extends NativeAnimationControls
    implements AnimationPlaybackControls
{
    // Resolve the current finished promise
    private resolveFinishedPromise: VoidFunction

    // A promise that resolves when the animation is complete
    private currentFinishedPromise: Promise<void>

    private removeAnimation: VoidFunction

    private setValue: (
        element: HTMLElement,
        name: string,
        value: string
    ) => void

    constructor(
        element: Element,
        valueName: string,
        valueKeyframes: ValueKeyframesDefinition,
        options: ValueAnimationOptions
    ) {
        const isCSSVar = valueName.startsWith("--")

        invariant(
            typeof options.type !== "string",
            `animateMini doesn't support "type" as a string. Did you mean to import { spring } from "framer-motion"?`
        )

        const existingAnimation =
            getElementAnimationState(element).get(valueName)
        existingAnimation && existingAnimation.stop()

        const readInitialKeyframe = () => {
            return valueName.startsWith("--")
                ? (element as HTMLElement).style.getPropertyValue(valueName)
                : window.getComputedStyle(element)[valueName as any]
        }

        if (!Array.isArray(valueKeyframes)) {
            valueKeyframes = [valueKeyframes]
        }

        hydrateKeyframes(valueName, valueKeyframes, readInitialKeyframe)

        // TODO: Replace this with toString()?
        if (isGenerator(options.type)) {
            const generatorOptions = createGeneratorEasing(
                options,
                100,
                options.type
            )

            options.ease = supportsLinearEasing()
                ? generatorOptions.ease
                : defaultEasing
            options.duration = secondsToMilliseconds(generatorOptions.duration)
            options.type = "keyframes"
        } else {
            options.ease = options.ease || defaultEasing
        }

        const onFinish = () => {
            this.setValue(
                element as HTMLElement,
                valueName,
                getFinalKeyframe(valueKeyframes as string[], options)
            )
            this.cancel()
            this.resolveFinishedPromise()
        }

        const init = () => {
            this.setValue = isCSSVar ? setCSSVar : setStyle
            this.options = options
            this.updateFinishedPromise()
            this.removeAnimation = () => state.get(element)?.delete(valueName)
        }

        if (!supportsWaapi()) {
            super()
            init()
            onFinish()
        } else {
            super(
                startWaapiAnimation(
                    element,
                    valueName,
                    valueKeyframes as string[],
                    options
                )
            )

            init()

            if (options.autoplay === false) {
                this.animation!.pause()
            }

            this.animation!.onfinish = onFinish

            getElementAnimationState(element).set(valueName, this)
        }
    }

    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve: VoidFunction, reject?: VoidFunction) {
        return this.currentFinishedPromise.then(resolve, reject)
    }

    private updateFinishedPromise() {
        this.currentFinishedPromise = new Promise((resolve) => {
            this.resolveFinishedPromise = resolve
        })
    }

    play() {
        if (this.state === "finished") {
            this.updateFinishedPromise()
        }

        super.play()
    }

    cancel() {
        this.removeAnimation()
        super.cancel()
    }
}
