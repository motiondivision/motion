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
 * loaded, and the animation code carries on from it once it has.
 */
export interface AppearAnimation {
    /**
     * The `animation` shorthand, and the custom properties its keyframes
     * read each value's target from.
     */
    style: { [key: string]: string | number }
    /**
     * The CSS property each animation is of, by its name.
     */
    properties: { [name: string]: string }
    /**
     * Initial values for the values that had none.
     */
    values: { [key: string]: number }
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

    return `${duration ?? 0.3}s ${ease} ${transition.delay || 0}s both`
}

/**
 * Whether Motion's animation code is here, in which case it animates the
 * element itself.
 */
export const hasAnimationFeature = () =>
    !!getFeatureDefinitions().animation?.Feature

/**
 * Make a component's enter animation, if it has one that CSS can run in
 * full. Otherwise its animation starts when Motion's animation code has
 * loaded, as it does without this.
 */
export function createAppearAnimation(
    props: MotionProps,
    latestValues: ResolvedValues,
    presenceContext: PresenceContextProps | null,
    defaultTransition: unknown
): AppearAnimation | undefined {
    const { animate, initial, style } = props

    if (
        initial === false ||
        presenceContext?.initial === false ||
        !animate ||
        isAnimationControls(animate) ||
        (style as any)?.animation
    ) {
        return
    }

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

    const targetStyle = buildVisualProps(
        getStyleRender,
        { ...latestValues, ...target },
        props as any
    ).style as { [key: string]: string | number }

    const appear: AppearAnimation = { style: {}, properties: {}, values: {} }
    const animations: string[] = []

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
            if (!isTransform && key !== "opacity") return
            from = appear.values[key] =
                key === "opacity" || key.startsWith("scale") ? 1 : 0
        }

        if (to === from) continue

        /**
         * Keyframes and motion values need the animation code, as do
         * values that aren't one CSS property.
         */
        if (
            (typeof to !== "number" && typeof to !== "string") ||
            key.startsWith("--") ||
            key.startsWith("origin")
        ) {
            return
        }

        const styleKey = isTransform ? "transform" : key
        const property = camelToDash(styleKey)
        const name = appearName(property)

        /**
         * A transform is one CSS property, so its values share the
         * timing of the first. The animation code gives each its own
         * when it takes over.
         */
        if (appear.properties[name]) continue

        const timing = cssTiming(
            {
                delay: (transition as any)?.delay,
                ...getValueTransition(transition, key),
            },
            key,
            from,
            to
        )
        const value = targetStyle[styleKey]

        if (!timing || value === undefined) return

        appear.properties[name] = property
        appear.style["--" + name] = value
        animations.push(name + " " + timing)
    }

    if (!animations.length) return

    appear.style.animation = animations.join(",")

    return appear
}
