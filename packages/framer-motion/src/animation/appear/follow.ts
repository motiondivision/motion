import {
    animateMotionValue,
    appearElements,
    appearHandoff,
    camelToDash,
    createGeneratorEasing,
    frame,
    mixNumber,
    spring,
    transformProps,
    type MotionValue,
    type StartAnimation,
} from "motion-dom"
import { clamp, easingDefinitionToFunction } from "motion-utils"
import { appearName, type AppearAnimation } from "./css"

/**
 * A value that follows a CSS animation.
 */
interface Follower {
    value: MotionValue<any>
    from: unknown
    target: unknown
    resume: (startTime: number) => StartAnimation
    /**
     * Ends the value's part in the animation.
     */
    end: (isComplete?: boolean) => void
    isDone?: boolean
}

/**
 * A CSS animation and the values that follow it. A transform has many.
 */
interface Followed {
    element: HTMLElement
    property: string
    animation: Animation
    startTime: number
    /**
     * Progress at a time since the animation started, as CSS eases it.
     */
    progress: (time: number) => number
    followers: Set<Follower>
    /**
     * The values that have followed it. Each does once, for the enter
     * animation.
     */
    keys: Set<string>
}

const followed = new WeakMap<HTMLElement, { [name: string]: Followed }>()

const isAppear = (animation: Animation) =>
    (animation as CSSAnimation).animationName?.startsWith("m-")

const now = ({ animation, startTime }: Followed) =>
    (animation.currentTime as number | null) ??
    (document.timeline.currentTime as number) - startTime

function sample(group: Followed, { from, target }: Follower, time: number) {
    return typeof from === "number" && typeof target === "number"
        ? mixNumber(from, target, group.progress(time))
        : /**
           * CSS mixes colours and the like in its own way, so read
           * what it's showing.
           */
          getComputedStyle(group.element).getPropertyValue(group.property)
}

/**
 * Take a CSS animation off its element. The element's `animation` style
 * goes with its last, as an element that is hidden and shown again would
 * otherwise play them again.
 */
function remove(group: Followed, name: string) {
    const { element } = group
    group.animation.cancel()
    delete followed.get(element)![name]

    if (!element.getAnimations().some(isAppear)) {
        element.style.animation = ""
        appearElements.delete(element)
    }
}

function makeProgress({ transition, from, to }: AppearAnimation["timings"][""]) {
    const { type, delay = 0 } = transition
    let duration = transition.duration ?? 0.3
    let ease: (progress: number) => number

    if (type === "spring" || type === spring) {
        const easing = createGeneratorEasing(
            typeof from === "number" && typeof to === "number"
                ? { ...transition, keyframes: [from, to] }
                : transition,
            100,
            spring
        )
        duration = easing.duration
        ease = easing.ease
    } else {
        ease = easingDefinitionToFunction(transition.ease ?? "easeOut")
    }

    return (time: number) =>
        ease(clamp(0, 1, (time / 1000 - delay) / duration))
}

/**
 * Leave enter animations that are running as CSS to run. The browser
 * plays them off the main thread, so each value only follows its
 * animation: it reads as animating, gives its value when asked, and takes
 * its target when the animation ends. Only another animation of the value
 * takes it over, from where it then is.
 */
export function followAppearAnimations() {
    appearHandoff.current = (visualElement, key, value, target, transition) => {
        const element = visualElement.current as HTMLElement

        /**
         * The animation that carries a value on in the animation code,
         * from the time the CSS animation started.
         */
        const resume = (startTime: number) =>
            animateMotionValue(
                key,
                value,
                target as any,
                { ...transition, startTime },
                visualElement,
                true
            )
        const appear = appearElements.get(element) as
            | AppearAnimation
            | undefined
        if (!appear) return

        const property = transformProps.has(key)
            ? "transform"
            : camelToDash(key)
        const name = appearName(property)
        const timing = appear.timings[name]
        if (!timing?.keys.includes(key)) return

        followed.has(element) || followed.set(element, {})
        const groups = followed.get(element)!
        let group = groups[name]

        if (!group) {
            const animation = element
                .getAnimations()
                .find(
                    (animation) =>
                        (animation as CSSAnimation).animationName === name
                )
            if (!animation) return

            group = groups[name] = {
                element,
                property,
                animation,
                startTime:
                    (animation.startTime as number | null) ??
                    (document.timeline.currentTime as number) -
                        (animation.currentTime as number),
                progress: makeProgress(timing),
                followers: new Set(),
                keys: new Set(),
            }

            /**
             * At the end each value takes its target. Once that has
             * rendered, the CSS animation can go.
             */
            const finish = () => {
                group.followers.forEach((follower) => {
                    follower.end(true)
                    follower.value.set(follower.target)
                })
                frame.postRender(() =>
                    frame.postRender(() => remove(group, name))
                )
            }

            animation.playState === "finished"
                ? queueMicrotask(finish)
                : animation.addEventListener("finish", finish)
        }

        if (group.keys.has(key)) return
        group.keys.add(key)

        return (complete) => {
            let resolve!: VoidFunction
            const finished = new Promise<void>((r) => (resolve = r))

            const follower: Follower = {
                value,
                from: value.getCurrent(),
                target,
                resume,
                end: (isComplete) => {
                    follower.isDone = true
                    group.followers.delete(follower)
                    isComplete && complete()
                    resolve()
                },
            }
            group.followers.add(follower)

            return {
                get state() {
                    return follower.isDone ? "finished" : "running"
                },
                finished,
                then: (onResolve: VoidFunction, onReject?: VoidFunction) =>
                    finished.then(onResolve, onReject),
                liveValue: () =>
                    follower.isDone
                        ? undefined
                        : sample(group, follower, now(group)),
                /**
                 * Another animation of the value is about to start. It
                 * starts from where the CSS animation is, and the other
                 * values of that animation carry on in the animation
                 * code.
                 */
                stop: () => {
                    if (follower.isDone) return

                    const time = now(group)
                    const { followers, startTime } = group

                    followers.forEach((other) => {
                        other.end()

                        if (other === follower) {
                            const latest = sample(group, other, time)

                            typeof latest === "number"
                                ? other.value.setWithVelocity(
                                      sample(group, other, time - 10),
                                      latest,
                                      10
                                  )
                                : other.value.set(latest)
                        } else {
                            /**
                             * This starts from the value's initial
                             * value, at the time the CSS animation did.
                             */
                            other.value.start(other.resume(startTime))
                        }
                    })

                    remove(group, name)
                },
            } as any
        }
    }
}
