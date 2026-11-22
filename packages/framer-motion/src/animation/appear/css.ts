import {
    buildVisualProps,
    camelToDash,
    createGeneratorEasing,
    cubicBezierAsString,
    generateLinearEasing,
    getDefaultTransition,
    getFeatureDefinitions,
    getStyleRender,
    getValueTransition,
    isAnimationControls,
    isMotionValue,
    isTransitionDefined,
    resolveVariantFromProps,
    spring,
    supportedWaapiEasing,
    transformProps,
    type ResolvedValues,
} from "motion-dom"
import { isBezierDefinition } from "motion-utils"
import type { PresenceContextProps } from "../../context/PresenceContext"
import type { MotionProps } from "../../motion/types"

/**
 * A component's enter animation as CSS. It starts as soon as the browser
 * has the element's styles, before any of Motion's animation code has
 * loaded. When that arrives it leaves the animation to run.
 */
export interface AppearAnimation {
    /**
     * The `animation` shorthand, and the custom properties its keyframes
     * read each value from.
     */
    style: { [key: string]: string | number }
    /**
     * Each animation in the `animation` shorthand. One is taken out when
     * the animation code takes its values over.
     */
    list: string[]
    /**
     * The @keyframes rule of each animation, by its name.
     */
    rules: { [name: string]: string }
    /**
     * Initial values for the values that had none.
     */
    values: { [key: string]: number }
    /**
     * What each animation plays, by its name, for the animation code to
     * follow it.
     */
    timings: { [name: string]: AppearTiming }
    /**
     * Each value's target.
     */
    targets: { [key: string]: unknown }
    /**
     * The animations that make the element's transform. They end, and
     * are taken over, as one.
     */
    transform: string[]
    /**
     * The value each animated value starts at, and each transform value
     * ends at.
     */
    from: { [key: string]: any }
    to: { [key: string]: number }
    /**
     * Values a gesture set before the animation code arrived, which the
     * element shows in place of its animation of them.
     */
    held?: { [key: string]: unknown }
}

export interface AppearTiming {
    /**
     * The values the animation is of. A transform has many.
     */
    keys: string[]
    /**
     * Its duration, easing and delay as CSS.
     */
    css: string
    /**
     * The transition the animation was made from, and the numbers its
     * spring ran between.
     */
    transition: any
    from: unknown
    to: unknown
}

export const appearName = (property: string) => "m-" + property

/**
 * Each property has one rule, shared by every element that animates it.
 * It animates from the element's own style, which holds its initial
 * values, to the target the element sets as a custom property.
 */
export const appearRule = (property: string) =>
    `@keyframes ${appearName(property)}{to{${property}:var(--${appearName(
        property
    )})}}`

/**
 * `translate`, `scale` and `rotate` are properties of their own, so a
 * transform of only these has an animation for each, with its own timing.
 * The element's `transform` style holds the same values, so one more
 * animation holds that at none.
 */
const independentRule = (property: string) => {
    const name = appearName(property)
    return `@keyframes ${name}{from{${property}:var(--${name}-from)}to{${property}:var(--${name})}}`
}

export const holdName = "m-hold"
const holdRule = `@keyframes ${holdName}{from,to{transform:none}}`

const independent: { [property: string]: string[] } = {
    translate: ["x", "y", "z"],
    scale: ["scale"],
    rotate: ["rotate"],
}

const independentKeys = new Set(["x", "y", "z", "scale", "rotate"])

const defaultOf = (key: string) => (key === "scale" ? 1 : 0)

/**
 * A property's value from the transform values it's made of.
 */
export function independentValue(
    property: string,
    values: { [key: string]: number }
) {
    const get = (key: string) => values[key] ?? defaultOf(key)

    return property === "translate"
        ? `${get("x")}px ${get("y")}px ${get("z")}px`
        : property === "scale"
        ? get("scale")
        : get("rotate") + "deg"
}

/**
 * The name of the animation a value is in.
 */
export function animationOf(key: string, appear: AppearAnimation) {
    for (const name in appear.timings) {
        if (appear.timings[name].keys.includes(key)) return name
    }
}

/**
 * The duration and easing of a value's transition as CSS, or undefined if
 * CSS can't express it.
 */
function cssTiming(transition: any, key: string, from: unknown, to: unknown) {
    transition = { ...transition }

    if (!isTransitionDefined(transition)) {
        Object.assign(
            transition,
            getDefaultTransition(key, { keyframes: [from, to] } as any)
        )
    }

    const { type, repeat } = transition
    let { duration, ease = "easeOut" } = transition

    if (type === false || duration === 0 || repeat) return

    if (type === "spring" || type === spring) {
        const easing = createGeneratorEasing(
            typeof from === "number" && typeof to === "number"
                ? { ...transition, keyframes: [from, to] }
                : transition,
            100,
            spring
        )
        duration = easing.duration
        ease = generateLinearEasing(easing.ease, duration * 1000, 20)
    } else if (typeof type === "function" || type === "inertia") {
        return
    } else if (isBezierDefinition(ease)) {
        ease = cubicBezierAsString(ease)
    } else {
        ease = supportedWaapiEasing[ease as keyof typeof supportedWaapiEasing]
    }

    if (typeof ease !== "string") return

    return [
        `${duration ?? 0.3}s ${ease} ${transition.delay || 0}s both`,
        transition,
    ] as const
}

/**
 * Whether Motion's animation code is here, in which case it animates the
 * element itself.
 */
export const hasAnimationFeature = () =>
    !!getFeatureDefinitions().animation?.Feature

/**
 * The `animation` style of a list of animations. A page with an enter
 * animation that CSS can't run sets --m to none, which turns every one
 * off, so they all start together when the animation code arrives.
 */
export const appearStyle = (list: string[]) =>
    list.length ? `var(--m,${list.join(",")})` : ""

/**
 * The rule that turns every CSS enter animation off.
 */
export const appearOffName = "m-off"
export const appearOffRule = ":root{--m:none}"

/**
 * Make a component's enter animation, if it has one that CSS can run in
 * full. Otherwise its animation starts when Motion's animation code has
 * loaded, as it does without this.
 *
 * Returns the reason, if the component has an enter animation that CSS
 * can't run.
 */
export function createAppearAnimation(
    props: MotionProps,
    latestValues: ResolvedValues,
    presenceContext: PresenceContextProps | null,
    defaultTransition: unknown
): AppearAnimation | string | undefined {
    const { animate, initial, style } = props

    if (
        initial === false ||
        presenceContext?.initial === false ||
        !animate ||
        isAnimationControls(animate)
    ) {
        return
    }

    if ((style as any)?.animation) return "an animation style"

    /**
     * A component that reports every frame needs the animation code
     * to make them.
     */
    if (props.onUpdate) return "onUpdate"

    const resolved = resolveVariantFromProps(
        props as any,
        Array.isArray(animate) ? animate[animate.length - 1] : (animate as any)
    )
    if (!resolved) return

    const {
        transition = props.transition ?? defaultTransition,
        transitionEnd,
        ...target
    } = resolved as any

    const final = { ...latestValues, ...target }
    const targetStyle = buildVisualProps(getStyleRender, final, props as any)
        .style as { [key: string]: string | number }

    const appear: AppearAnimation = {
        style: {},
        list: [],
        rules: {},
        values: {},
        timings: {},
        targets: {},
        transform: [],
        from: {},
        to: {},
    }
    const animations = appear.list

    /**
     * Whether every transform value the element has is one that the
     * `translate`, `scale` and `rotate` properties can show.
     */
    let isIndependent = !props.transformTemplate
    for (const key in final) {
        if (transformProps.has(key)) {
            isIndependent &&=
                independentKeys.has(key) && typeof final[key] === "number"
            appear.to[key] = final[key]
        }
    }

    const timingOf = (key: string, from: unknown, to: unknown) =>
        cssTiming(
            {
                delay: (transition as any)?.delay,
                ...getValueTransition(transition, key),
            },
            key,
            from,
            to
        )

    const add = (
        name: string,
        rule: string,
        key: string,
        timing: NonNullable<ReturnType<typeof cssTiming>>,
        from: unknown,
        to: unknown
    ) => {
        appear.rules[name] = rule
        appear.timings[name] = {
            keys: [key],
            css: timing[0],
            transition: timing[1],
            from,
            to,
        }
        animations.push(name + " " + timing[0])
    }

    for (const key in target) {
        const to = target[key]
        const isTransform = transformProps.has(key)
        let from = latestValues[key]

        /**
         * A value without an initial value animates from its default.
         * The animation code would read it from the element, which is
         * mid-animation by then, so it's given as a style.
         */
        if (from === undefined) {
            if (!isTransform && key !== "opacity") {
                return key + " without an initial value"
            }
            from = appear.values[key] =
                key === "opacity" || key.startsWith("scale") ? 1 : 0
        }

        appear.from[key] = from

        if (to === from) continue

        /**
         * Keyframes and motion values need the animation code, as do
         * values that aren't one CSS property. So does a value the
         * component was given as a motion value, as its readers expect
         * every frame, and a transform that layout or drag also moves.
         */
        if (typeof to !== "number" && typeof to !== "string") {
            return "keyframes of " + key
        }

        if (
            key.startsWith("--") ||
            key.startsWith("origin") ||
            isMotionValue((style as any)?.[key]) ||
            (isTransform &&
                (typeof to !== "number" ||
                    typeof from !== "number" ||
                    props.layout ||
                    props.layoutId ||
                    props.drag))
        ) {
            return isTransform && (props.layout || props.layoutId || props.drag)
                ? key + " with layout or drag"
                : key
        }

        appear.targets[key] = to

        const property =
            isTransform && isIndependent
                ? Object.keys(independent).find((property) =>
                      independent[property].includes(key)
                  )!
                : camelToDash(isTransform ? "transform" : key)
        const name = appearName(property)
        const existing = appear.timings[name]
        const timing = timingOf(key, from, to)

        if (!timing) return "the transition of " + key

        if (existing) {
            /**
             * x, y and z are one property, so they need one timing.
             * Otherwise the whole transform is one animation, with the
             * timing of its first value.
             */
            if (
                isIndependent &&
                timing[0] !== existing.css &&
                /**
                 * Springs of one transition over other distances differ
                 * only in when they come to rest.
                 */
                JSON.stringify(timing[1]) !==
                    JSON.stringify(existing.transition)
            ) {
                isIndependent = false
                return createSharedTransform()
            }

            existing.keys.push(key)
            continue
        }

        if (isTransform) {
            appear.transform.push(name)
            add(
                name,
                isIndependent
                    ? independentRule(property)
                    : appearRule(property),
                key,
                timing,
                from,
                to
            )
            isIndependent ||
                (appear.style["--" + name] = targetStyle.transform || "none")
        } else {
            const value = targetStyle[key]
            if (value === undefined) return key

            add(name, appearRule(property), key, timing, from, to)
            appear.style["--" + name] = value
        }
    }

    if (!animations.length) return

    if (isIndependent && appear.transform.length) {
        for (const key in appear.to) appear.from[key] ??= appear.to[key]

        /**
         * A property that doesn't animate still has to show its value,
         * as the element's transform is held at none.
         */
        for (const property in independent) {
            const name = appearName(property)
            const isAnimated = appear.timings[name]

            if (
                !isAnimated &&
                independent[property].every(
                    (key) =>
                        (appear.to[key] ?? defaultOf(key)) === defaultOf(key)
                )
            ) {
                continue
            }

            if (!isAnimated) {
                appear.rules[name] = independentRule(property)
                appear.transform.push(name)
                animations.push(name + " 1s both")
            }

            appear.style[`--${name}-from`] = independentValue(
                property,
                appear.from
            )
            appear.style["--" + name] = independentValue(property, appear.to)
        }

        appear.rules[holdName] = holdRule
        appear.transform.push(holdName)
        animations.push(holdName + " 1s both")
    }

    appear.style.animation = appearStyle(animations)

    return appear

    /**
     * Start again with the transform as one animation.
     */
    function createSharedTransform() {
        return createAppearAnimation(
            { ...props, transformTemplate: sharedTransform } as any,
            latestValues,
            presenceContext,
            defaultTransition
        )
    }
}

/**
 * A template that changes nothing, which marks a transform as one that
 * can't be split into properties.
 */
const sharedTransform = (_: unknown, generated: string) => generated
