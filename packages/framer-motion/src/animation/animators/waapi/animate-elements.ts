import {
    animationMapKey,
    AnimationPlaybackControls,
    AnimationScope,
    applyPxDefaults,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    fillWildcards,
    getAnimationMap,
    getComputedStyle,
    getValueTransition,
    NativeAnimation,
    NativeAnimationOptions,
    resolveElements,
    UnresolvedValueKeyframe,
    ValueKeyframe,
} from "motion-dom"
import { invariant, secondsToMilliseconds } from "motion-utils"

interface AnimationDefinition {
    map: Map<string, NativeAnimation<any>>
    key: string
    unresolvedKeyframes: UnresolvedValueKeyframe[]
    options: Omit<NativeAnimationOptions, "keyframes"> & {
        keyframes?: ValueKeyframe[]
    }
}

export function animateElements(
    elementOrSelector: ElementOrSelector,
    keyframes: DOMKeyframesDefinition,
    options?: DynamicAnimationOptions,
    scope?: AnimationScope
) {
    const elements = resolveElements(elementOrSelector, scope) as Array<
        HTMLElement | SVGElement
    >
    const numElements = elements.length

    invariant(Boolean(numElements), "No valid element provided.")

    /**
     * WAAPI doesn't support interrupting animations.
     *
     * Therefore, starting animations requires a three-step process:
     * 1. Stop existing animations (write styles to DOM)
     * 2. Resolve keyframes (read styles from DOM)
     * 3. Create new animations (write styles to DOM)
     *
     * The hybrid `animate()` function uses AsyncAnimation to resolve
     * keyframes before creating new animations, which removes style
     * thrashing. Here, we have much stricter filesize constraints.
     * Therefore we do this in a synchronous way that ensures that
     * at least within `animate()` calls there is no style thrashing.
     *
     * In the motion-native-animate-mini-interrupt benchmark this
     * was 80% faster than a single loop.
     */
    const animationDefinitions: AnimationDefinition[] = []

    /**
     * Step 1: Build options and stop existing animations (write)
     */
    for (let i = 0; i < numElements; i++) {
        const element = elements[i]
        const elementTransition = { ...options }

        /**
         * Resolve stagger function if provided.
         */
        if (typeof elementTransition.delay === "function") {
            elementTransition.delay = elementTransition.delay(i, numElements)
        }

        for (const valueName in keyframes) {
            let valueKeyframes = keyframes[valueName as keyof typeof keyframes]!

            if (!Array.isArray(valueKeyframes)) {
                valueKeyframes = [valueKeyframes]
            }

            const valueOptions = {
                ...getValueTransition(elementTransition as any, valueName),
            }

            valueOptions.duration &&= secondsToMilliseconds(
                valueOptions.duration
            )

            valueOptions.delay &&= secondsToMilliseconds(valueOptions.delay)

            /**
             * If there's an existing animation playing on this element then stop it
             * before creating a new one.
             */
            const map = getAnimationMap(element)
            const key = animationMapKey(
                valueName,
                valueOptions.pseudoElement || ""
            )
            const currentAnimation = map.get(key)
            currentAnimation && currentAnimation.stop()

            animationDefinitions.push({
                map,
                key,
                unresolvedKeyframes: valueKeyframes,
                options: {
                    ...valueOptions,
                    element,
                    name: valueName,
                    allowFlatten:
                        !elementTransition.type && !elementTransition.ease,
                },
            })
        }
    }

    /**
     * Step 2: Resolve keyframes (read)
     */
    for (let i = 0; i < animationDefinitions.length; i++) {
        const { unresolvedKeyframes, options: animationOptions } =
            animationDefinitions[i]

        const { element, name, pseudoElement } = animationOptions
        if (!pseudoElement && unresolvedKeyframes[0] === null) {
            unresolvedKeyframes[0] = getComputedStyle(element, name)
        }

        fillWildcards(unresolvedKeyframes)
        applyPxDefaults(unresolvedKeyframes, name)

        /**
         * If we only have one keyframe, explicitly read the initial keyframe
         * from the computed style. This is to ensure consistency with WAAPI behaviour
         * for restarting animations, for instance .play() after finish, when it
         * has one vs two keyframes.
         */
        if (!pseudoElement && unresolvedKeyframes.length < 2) {
            unresolvedKeyframes.unshift(getComputedStyle(element, name))
        }

        animationOptions.keyframes = unresolvedKeyframes as ValueKeyframe[]
    }

    /**
     * Step 3: Create new animations (write)
     */
    const animations: AnimationPlaybackControls[] = []
    for (let i = 0; i < animationDefinitions.length; i++) {
        const { map, key, options: animationOptions } = animationDefinitions[i]
        const animation = new NativeAnimation(
            animationOptions as NativeAnimationOptions
        )

        map.set(key, animation)
        animation.finished.finally(() => map.delete(key))

        animations.push(animation)
    }

    return animations
}
