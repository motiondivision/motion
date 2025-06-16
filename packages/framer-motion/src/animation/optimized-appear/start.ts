import {
    Batcher,
    MotionValue,
    startWaapiAnimation,
    ValueAnimationTransition,
} from "motion-dom"
import { noop } from "motion-utils"
import { optimizedAppearDataId } from "./data-id"
import { getOptimisedAppearId } from "./get-appear-id"
import { handoffOptimizedAppearAnimation } from "./handoff"
import { appearAnimationStore, appearComplete, AppearStoreEntry } from "./store"
import { appearStoreId } from "./store-id"
import "./types"
import type { WithAppearProps } from "./types"

/**
 * A single time to use across all animations to manually set startTime
 * and ensure they're all in sync.
 */
let startFrameTime: number

/**
 * A dummy animation to detect when Chrome is ready to start
 * painting the page and hold off from triggering the real animation
 * until then. We only need one animation to detect paint ready.
 *
 * https://bugs.chromium.org/p/chromium/issues/detail?id=1406850
 */
let readyAnimation: Animation

/**
 * Keep track of animations that were suspended vs cancelled so we
 * can easily resume them when we're done measuring layout.
 */
const suspendedAnimations = new Set<AppearStoreEntry>()

function resumeSuspendedAnimations() {
    suspendedAnimations.forEach((data) => {
        data.animation.play()
        data.animation.startTime = data.startTime
    })
    suspendedAnimations.clear()
}

export function startOptimizedAppearAnimation(
    element: HTMLElement,
    name: string,
    keyframes: string[] | number[],
    options: ValueAnimationTransition<number | string>,
    onReady?: (animation: Animation) => void
): void {
    // Prevent optimised appear animations if Motion has already started animating.
    if (window.MotionIsMounted) {
        return
    }

    const id = element.dataset[optimizedAppearDataId]
    if (!id) return

    window.MotionHandoffAnimation = handoffOptimizedAppearAnimation

    const storeId = appearStoreId(id, name)
    if (!readyAnimation) {
        readyAnimation = startWaapiAnimation(
            element,
            name,
            [keyframes[0] as number, keyframes[0] as number],
            /**
             * 10 secs is basically just a super-safe duration to give Chrome
             * long enough to get the animation ready.
             */
            { duration: 10000, ease: "linear" }
        )

        appearAnimationStore.set(storeId, {
            animation: readyAnimation,
            startTime: null,
        })

        /**
         * If there's no readyAnimation then there's been no instantiation
         * of handoff animations.
         */
        window.MotionHandoffAnimation = handoffOptimizedAppearAnimation

        window.MotionHasOptimisedAnimation = (
            elementId?: string,
            valueName?: string
        ) => {
            if (!elementId) return false

            /**
             * Keep a map of elementIds that have started animating. We check
             * via ID instead of Element because of hydration errors and
             * pre-hydration checks. We also actively record IDs as they start
             * animating rather than simply checking for data-appear-id as
             * this attrbute might be present but not lead to an animation, for
             * instance if the element's appear animation is on a different
             * breakpoint.
             */
            if (!valueName) {
                return appearComplete.has(elementId)
            }

            const animationId = appearStoreId(elementId, valueName)
            return Boolean(appearAnimationStore.get(animationId))
        }

        window.MotionHandoffMarkAsComplete = (elementId: string): void => {
            if (appearComplete.has(elementId)) {
                appearComplete.set(elementId, true)
            }
        }

        window.MotionHandoffIsComplete = (elementId: string): boolean => {
            return appearComplete.get(elementId) === true
        }

        /**
         * We only need to cancel transform animations as
         * they're the ones that will interfere with the
         * layout animation measurements.
         */
        window.MotionCancelOptimisedAnimation = (
            elementId: string,
            valueName: string,
            frame?: Batcher,
            canResume?: boolean
        ) => {
            const animationId = appearStoreId(elementId, valueName)
            const data = appearAnimationStore.get(animationId)

            if (!data) return

            if (frame && canResume === undefined) {
                /**
                 * Wait until the end of the subsequent frame to cancel the animation
                 * to ensure we don't remove the animation before the main thread has
                 * had a chance to resolve keyframes and render.
                 */
                frame.postRender(() => {
                    frame.postRender(() => {
                        data.animation.cancel()
                    })
                })
            } else {
                data.animation.cancel()
            }

            if (frame && canResume) {
                suspendedAnimations.add(data)
                frame.render(resumeSuspendedAnimations)
            } else {
                appearAnimationStore.delete(animationId)

                /**
                 * If there are no more animations left, we can remove the cancel function.
                 * This will let us know when we can stop checking for conflicting layout animations.
                 */
                if (!appearAnimationStore.size) {
                    window.MotionCancelOptimisedAnimation = undefined
                }
            }
        }

        window.MotionCheckAppearSync = (
            visualElement: WithAppearProps,
            valueName: string,
            value: MotionValue
        ) => {
            const appearId = getOptimisedAppearId(visualElement)

            if (!appearId) return

            const valueIsOptimised = window.MotionHasOptimisedAnimation?.(
                appearId,
                valueName
            )
            const externalAnimationValue =
                visualElement.props.values?.[valueName]

            if (!valueIsOptimised || !externalAnimationValue) return

            const removeSyncCheck = value.on(
                "change",
                (latestValue: string | number) => {
                    if (externalAnimationValue.get() !== latestValue) {
                        window.MotionCancelOptimisedAnimation?.(
                            appearId,
                            valueName
                        )
                        removeSyncCheck()
                    }
                }
            )

            return removeSyncCheck
        }
    }

    const startAnimation = () => {
        readyAnimation.cancel()

        const appearAnimation = startWaapiAnimation(
            element,
            name,
            keyframes,
            options
        )

        /**
         * Record the time of the first started animation. We call performance.now() once
         * here and once in handoff to ensure we're getting
         * close to a frame-locked time. This keeps all animations in sync.
         */
        if (startFrameTime === undefined) {
            startFrameTime = performance.now()
        }

        appearAnimation.startTime = startFrameTime

        appearAnimationStore.set(storeId, {
            animation: appearAnimation,
            startTime: startFrameTime,
        })

        if (onReady) onReady(appearAnimation)
    }

    appearComplete.set(id, false)

    if (readyAnimation.ready) {
        readyAnimation.ready.then(startAnimation).catch(noop)
    } else {
        startAnimation()
    }
}
