import {
    appearElements,
    isAnimationControls,
    motionValue,
    resolveVariant,
    transformProps,
    variantPriorityOrder,
    type AnimationState,
    type VisualElement,
} from "motion-dom"
import {
    animationOf,
    appearName,
    holdName,
    independentValue,
    type AppearAnimation,
} from "./css"
import { dropAppearAnimations } from "./handoff"

const independentProperty = (key: string) =>
    key === "scale" || key === "rotate"
        ? key
        : key === "x" || key === "y" || key === "z"
        ? "translate"
        : undefined

function setValue(visualElement: VisualElement, key: string, value: any) {
    visualElement.hasValue(key)
        ? visualElement.getValue(key)!.set(value)
        : visualElement.addValue(key, motionValue(value))
    visualElement.scheduleRender()
}

export interface EarlyState extends AnimationState {
    /**
     * The gestures that are active, for the animation code to carry on
     * with when it arrives.
     */
    active: { [type: string]: boolean }
    /**
     * Called when the component's element is in the document.
     */
    mount: VoidFunction
    unmount: VoidFunction
    /**
     * Ends the wait of an exit that began before the animation code
     * arrived, once that code has run it.
     */
    onExit: VoidFunction
}

/**
 * What stands in for a component's animation state until the animation
 * code arrives. A gesture then can't animate, so the element changes to
 * the gesture's values at once, and back when the gesture ends.
 */
export function createEarlyState(visualElement: VisualElement): EarlyState {
    const active: EarlyState["active"] = {}

    /**
     * The values gestures have set, and what each was before.
     */
    let applied: { [key: string]: unknown } = {}
    const before: { [key: string]: unknown } = {}

    const element = () => visualElement.current as HTMLElement
    const getAppear = () =>
        appearElements.get(element()) as AppearAnimation | undefined

    /**
     * Show a transform value in place of what the CSS animations play
     * of it, or stop doing so. The other transform values carry on.
     */
    function hold(appear: AppearAnimation, key: string, value?: number) {
        const property = independentProperty(key)!
        const name = appearName(property)
        const held = (appear.held ||= {}) as { [key: string]: number }
        const { style } = element()

        value === undefined ? delete held[key] : (held[key] = value)

        if (appear.transform.includes(name)) {
            const from = independentValue(property, { ...appear.from, ...held })
            const to = independentValue(property, { ...appear.to, ...held })
            style.setProperty(`--${name}-from`, from as string)
            style.setProperty("--" + name, to as string)
        } else {
            /**
             * The property has no animation, so the element's style of
             * it shows.
             */
            ;(style as any)[property] = independentValue(property, {
                ...appear.to,
                ...held,
            })
        }
    }

    /**
     * The same for any other animation. Its keyframe reads its target
     * from a custom property, and starts from the element's style, so
     * both are rendered with the value in place.
     */
    function holdShared(
        appear: AppearAnimation,
        name: string,
        key: string,
        value?: unknown
    ) {
        const held = (appear.held ||= {})
        const { style } = element()
        const keys = new Set([...appear.timings[name].keys, key])

        value === undefined ? delete held[key] : (held[key] = value)

        const render = (values: { [key: string]: unknown }) => {
            keys.forEach((other) =>
                setValue(
                    visualElement,
                    other,
                    held[other] ?? values[other] ?? before[other]
                )
            )
            visualElement.render()
        }

        render(appear.targets)
        style.setProperty("--" + name, style.getPropertyValue(name.slice(2)))
        render(appear.from)
    }

    function set(key: string, value: any, isRestore?: boolean) {
        const appear = getAppear()
        const isTransform = transformProps.has(key)
        const [transform] = appear?.transform || []
        const isIndependent = appear?.transform.includes(holdName)
        const name =
            appear &&
            (animationOf(key, appear) ||
                (isTransform && !isIndependent ? transform : undefined))

        if (appear && isIndependent && independentProperty(key)) {
            hold(appear, key, isRestore ? undefined : value)
            /**
             * The value itself goes back to where its animation
             * started, for the animation code to read.
             */
            setValue(
                visualElement,
                key,
                isRestore ? appear.from[key] ?? before[key] : value
            )
        } else if (name) {
            holdShared(appear!, name, key, isRestore ? undefined : value)
        } else {
            if (appear && isTransform && transform) {
                /**
                 * A transform value that `translate`, `scale` and
                 * `rotate` can't show. The enter animation of the
                 * transform ends here, at its targets.
                 */
                dropAppearAnimations(element(), appear, appear.transform)
                for (const other in appear.targets) {
                    transformProps.has(other) &&
                        setValue(visualElement, other, appear.targets[other])
                }
                appear.transform = []
            }

            setValue(visualElement, key, isRestore ? before[key] : value)
        }
    }

    function update() {
        const next: { [key: string]: unknown } = {}

        for (const type of variantPriorityOrder) {
            /**
             * Gestures change the component. Its other animations, and
             * its exit, wait for the animation code.
             */
            if (
                !active[type] ||
                type === "animate" ||
                type === "whileInView" ||
                type === "exit"
            ) {
                continue
            }

            const resolved = resolveVariant(
                visualElement,
                (visualElement.getProps() as any)[type]
            )
            if (!resolved) continue

            const { transition, transitionEnd, ...target } = resolved as any
            Object.assign(next, target, transitionEnd)
        }

        for (const key in { ...applied, ...next }) {
            let value = next[key]
            if (Array.isArray(value)) value = value[value.length - 1]
            if (value === applied[key]) continue

            if (!(key in before)) {
                before[key] =
                    visualElement.getValue(key)?.get() ??
                    visualElement.readValue(key)
            }

            set(key, value, value === undefined)
        }

        applied = next
    }

    const done = () => Promise.resolve()

    /**
     * Animation controls start their animations themselves, with code
     * they bring. They're often started in an effect at mount, which is
     * before the animation code can arrive, so they're given the
     * component now.
     */
    let unsubscribe: VoidFunction | undefined
    let endExit: VoidFunction | undefined

    return {
        active,
        setActive: (type, isActive) => {
            active[type] = isActive
            update()

            if (type !== "exit") return done()

            /**
             * An exit waits for the animation code, which runs it from
             * what the element then shows.
             */
            endExit?.()
            endExit = undefined
            return isActive
                ? new Promise<void>((resolve) => (endExit = resolve))
                : done()
        },
        onExit: () => endExit?.(),
        mount: () => {
            const { animate } = visualElement.getProps()
            unsubscribe?.()
            unsubscribe = isAnimationControls(animate)
                ? animate.subscribe(visualElement as any)
                : undefined
        },
        unmount: () => unsubscribe?.(),
        animateChanges: done,
        setAnimateFunction: () => {},
        getState: () => ({}),
        reset: () => {},
    }
}
