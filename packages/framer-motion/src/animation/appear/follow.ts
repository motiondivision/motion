import {
    animateMotionValue,
    appearElements,
    appearHandoff,
    createGeneratorEasing,
    frame,
    mixNumber,
    spring,
    transformProps,
    type MotionValue,
    type StartAnimation,
    type VisualElement,
} from "motion-dom"
import { clamp, easingDefinitionToFunction } from "motion-utils"
import { animationOf, type AppearAnimation, type AppearTiming } from "./css"
import { animationsOn, dropAppearAnimations } from "./handoff"

/**
 * A value that follows a CSS animation.
 */
interface Follower {
    key: string
    /**
     * The animation the value is in.
     */
    name: string
    value: MotionValue<any>
    /**
     * Makes the animation that carries the value on in the animation
     * code, from the time the CSS animation started.
     */
    resume: (startTime: number) => StartAnimation
    /**
     * Ends the value's part in the animation.
     */
    end: (isComplete?: boolean) => void
    isDone?: boolean
}

/**
 * CSS animations that end, and are taken over, as one, and the values
 * that follow them. A transform is one unit, however many animations and
 * values it has. Any other property is a unit of one.
 */
interface Unit {
    element: HTMLElement
    appear: AppearAnimation
    visualElement: VisualElement
    /**
     * The names of its animations. The browser makes the animations
     * themselves again when the element is moved in the document.
     */
    names: string[]
    startTime: number
    followers: Set<Follower>
    /**
     * The values that have asked to follow. Each does once, for the
     * enter animation.
     */
    keys: Set<string>
    /**
     * Progress at a time since the unit started, by animation name, as
     * CSS eases it.
     */
    progress: { [name: string]: (time: number) => number }
    /**
     * The CSS animations have gone: they ended, or the animation code
     * took the values over.
     */
    isOver?: boolean
    isTakenOver?: boolean
}

const units = new WeakMap<HTMLElement, { [id: string]: Unit }>()

const nameOf = (animation: Animation) =>
    (animation as CSSAnimation).animationName

const now = (unit: Unit) =>
    (document.timeline.currentTime as number) - unit.startTime

function makeProgress({ transition, from, to }: AppearTiming) {
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

    return (time: number) => ease(clamp(0, 1, (time / 1000 - delay) / duration))
}

interface Playing {
    key: string
    name: string
}

/**
 * What the element shows of a value at a time.
 */
function sample(unit: Unit, { key, name }: Playing, time: number) {
    const { appear, element } = unit
    const from = appear.from[key]
    const target = appear.targets[key]

    return typeof from === "number" && typeof target === "number"
        ? mixNumber(
              from,
              target,
              (unit.progress[name] ||= makeProgress(appear.timings[name]))(time)
          )
        : /**
           * CSS mixes colours and the like in its own way, so read
           * what it's showing.
           */
          getComputedStyle(element).getPropertyValue(name.slice(2))
}

/**
 * Set a value to what the element shows, with its velocity, for an
 * animation that starts from there.
 */
function setLive(unit: Unit, value: MotionValue<any>, playing: Playing) {
    const time = now(unit)
    const latest = sample(unit, playing, time)

    typeof latest === "number"
        ? value.setWithVelocity(
              sample(unit, playing, time - 10) as number,
              latest,
              10
          )
        : value.set(latest)
}

const animationsOf = ({ element, names }: Pick<Unit, "element" | "names">) =>
    animationsOn(element).filter((animation) =>
        names.includes(nameOf(animation))
    )

/**
 * Take a unit's CSS animations off its element.
 */
function remove(unit: Unit) {
    const { element, appear, names } = unit
    unit.isOver = true
    dropAppearAnimations(element, appear, names)
}

/**
 * Carry a unit's values on in the animation code. One that another
 * animation is about to start from takes what the element shows. The
 * rest play from the time the CSS animations started.
 */
function takeOver(unit: Unit, interrupted?: Follower) {
    if (unit.isOver) return
    unit.isTakenOver = true

    /**
     * The element's own styles show once the CSS animations go, which
     * can be a frame before the animations that carry on first render.
     * So they're given what the CSS animations show now.
     */
    const { appear, visualElement } = unit
    const time = now(unit)
    unit.names.forEach((name) => {
        appear.timings[name]?.keys.forEach((key) => {
            /**
             * The value itself is where its animation started, as
             * that's where the animation that carries it on plays
             * from.
             */
            visualElement.getValue(key, appear.from[key])
            visualElement.setStaticValue(
                key,
                sample(unit, { key, name }, time) as any
            )
        })
    })
    visualElement.render()

    unit.followers.forEach((follower) => {
        follower.end()
        follower === interrupted
            ? setLive(unit, follower.value, follower)
            : follower.value.start(follower.resume(unit.startTime))
    })

    remove(unit)
}

function getUnit(
    visualElement: VisualElement,
    appear: AppearAnimation,
    name: string
) {
    const element = visualElement.current as HTMLElement
    const isTransform = appear.transform.includes(name)
    const id = isTransform ? "transform" : name

    units.has(element) || units.set(element, {})
    const elementUnits = units.get(element)!
    if (elementUnits[id]) return elementUnits[id]

    const names = isTransform ? appear.transform : [name]
    const animations = animationsOf({ element, names })
    const startTimes = animations.map(
        (animation) =>
            (animation.startTime as number | null) ??
            (document.timeline.currentTime as number) -
                (animation.currentTime as number)
    )

    /**
     * A layout animation has them off the element while it measures.
     */
    if (appear.measuring) {
        for (const name of names) {
            const start = appear.starts![name]
            start === undefined || startTimes.push(start)
        }
    }

    if (!startTimes.length) {
        /**
         * The page turned its CSS enter animations off, so the element
         * has none to follow.
         */
        dropAppearAnimations(element, appear, names)
        return
    }

    const unit: Unit = (elementUnits[id] = {
        element,
        appear,
        visualElement,
        names,
        startTime: Math.min(...startTimes),
        followers: new Set(),
        keys: new Set(),
        progress: {},
    })

    /**
     * When the last animation of the unit ends, each value takes its
     * target. Once that has rendered, the CSS animations can go.
     */
    const check = () => {
        if (
            unit.isOver ||
            appear.measuring ||
            animationsOf(unit).some(
                (animation) =>
                    appear.timings[nameOf(animation)] &&
                    animation.playState !== "finished"
            )
        ) {
            return
        }

        unit.isOver = true
        element.removeEventListener("animationend", check)
        unit.followers.forEach((follower) => {
            follower.end(true)
            follower.value.set(appear.targets[follower.key])
        })
        frame.postRender(() => frame.postRender(() => remove(unit)))
    }

    element.addEventListener("animationend", check)
    queueMicrotask(check)

    isTransform && appear.owned && takeOver(unit)

    return unit
}

/**
 * Leave enter animations that are running as CSS to run. The browser
 * plays them off the main thread, so each value only follows its
 * animation: it reads as animating, gives its value when asked, and takes
 * its target when the animation ends. Only another animation of the value
 * takes it over, from where it then is.
 */
export function followAppearAnimations() {
    appearHandoff.takeOver = (element) => {
        const unit = units.get(element as HTMLElement)?.transform

        if (unit && !unit.isOver) {
            takeOver(unit)
            return true
        }
    }

    appearHandoff.current = (visualElement, key, value, target, transition) => {
        const element = visualElement.current as HTMLElement
        /**
         * An element whose CSS animations have all gone is no longer
         * registered, but values of a unit that was taken over may
         * still ask to carry on.
         */
        const known = units.get(element)
        const appear =
            (appearElements.get(element) as AppearAnimation | undefined) ||
            (known && Object.values(known)[0]?.appear)
        if (!appear) return

        const name = animationOf(key, appear)

        if (!name) {
            /**
             * A transform value that the CSS animations don't play is
             * about to animate. The element's transform is theirs, so
             * they hand it back.
             */
            if (transformProps.has(key) && appear.transform[0]) {
                const unit = getUnit(
                    visualElement as any,
                    appear,
                    appear.transform[0]
                )
                unit && takeOver(unit)
            }
            return
        }

        const unit = getUnit(visualElement as any, appear, name)
        if (!unit || unit.keys.has(key)) return
        unit.keys.add(key)

        const resume = (startTime: number) =>
            animateMotionValue(
                key,
                value,
                appear.targets[key] as any,
                {
                    ...transition,
                    /**
                     * A parent that waits for its own animation starts
                     * this one late, so the delay is the one CSS has.
                     */
                    delay: appear.timings[name].transition.delay,
                    startTime,
                },
                visualElement,
                true
            )

        const playing = { key, name }

        /**
         * The value now has another target than the CSS animation. Its
         * animation starts from what the element shows.
         */
        if (target !== appear.targets[key]) {
            takeOver(unit)
            setLive(unit, value, playing)
            return
        }

        if (unit.isTakenOver) return resume(unit.startTime)
        if (unit.isOver) return

        return (complete) => {
            let resolve!: VoidFunction
            const finished = new Promise<void>((r) => (resolve = r))

            const follower: Follower = {
                ...playing,
                value,
                resume,
                end: (isComplete) => {
                    follower.isDone = true
                    unit.followers.delete(follower)
                    isComplete && complete()
                    resolve()
                },
            }
            unit.followers.add(follower)

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
                        : sample(unit, follower, now(unit)),
                /**
                 * Another animation of the value is about to start.
                 */
                stop: () => follower.isDone || takeOver(unit, follower),
            } as any
        }
    }
}
