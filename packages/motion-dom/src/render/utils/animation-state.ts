import type {
    AnimationDefinition,
    TargetAndTransition,
    VariantLabels,
} from "../../node/types"
import type { AnimationType } from "../types"
import type { VisualElementAnimationOptions } from "../../animation/interfaces/types"
import { animateVisualElement } from "../../animation/interfaces/visual-element"
import { calcChildStagger } from "../../animation/utils/calc-child-stagger"
import { isMotionValue } from "../../value/utils/is-motion-value"
import { isAnimationControls } from "./is-animation-controls"
import { isVariantLabel } from "./is-variant-label"
import { getTypeCustom, resolveVariant } from "./resolve-dynamic-variants"
import { shallowCompare } from "./shallow-compare"
import { variantPriorityOrder } from "./variant-props"

export type { VisualElementAnimationOptions }

export interface AnimationState {
    animateChanges: (type?: AnimationType) => Promise<any>
    setActive: (
        type: AnimationType,
        isActive: boolean,
        options?: VisualElementAnimationOptions
    ) => Promise<any>
    setAnimateFunction: (fn: any) => void
    getState: () => { [key: string]: AnimationTypeState }
    reset: () => void
}

interface DefinitionAndOptions {
    animation: AnimationDefinition
    options?: VisualElementAnimationOptions
}

export type AnimationList = string[] | TargetAndTransition[]

/**
 * Type for the animate function that can be injected.
 * This allows the animation implementation to be provided by the framework layer.
 */
export type AnimateFunction = (animations: DefinitionAndOptions[]) => Promise<any>

const reversePriorityOrder = [...variantPriorityOrder].reverse()

/**
 * Diffs the element's animation props (one layer per AnimationType, highest
 * priority wins each value) against the previous call and starts animations
 * for what changed.
 *
 * Uses `any` type for visualElement to avoid circular dependencies. It reads
 * props, parent, presenceContext, variantChildren, enteringChildren,
 * manuallyAnimateOnMount, blockInitialAnimation, getValue(),
 * getBaseTargetFromProps(), baseTarget and initialValues.
 */
export function createAnimationState(visualElement: any): AnimationState {
    let animate: AnimateFunction = (animations) =>
        Promise.all(
            animations.map(({ animation, options }) =>
                animateVisualElement(visualElement, animation, options)
            )
        )
    let state = createState()
    let isInitialRender = true

    /**
     * After a reset (StrictMode, Suspense, AnimatePresence re-entry) the next
     * animateChanges() mounts again, but initial={false} no longer applies.
     */
    let wasReset = false

    function animateChanges(changedActiveType?: AnimationType) {
        const { props, parent, manuallyAnimateOnMount } = visualElement
        const isMounting = isInitialRender || wasReset
        const animations: DefinitionAndOptions[] = []

        /**
         * Values removed from a type. A lower-priority type that defines
         * them animates them back, otherwise they fall back to a base target.
         */
        const removedKeys = new Set<string>()

        /**
         * Values claimed by active, higher-priority types.
         */
        let encounteredKeys: { [key: string]: any } = {}

        /**
         * Once a type has been deactivated, lower-priority variant labels
         * re-animate so variant children animate back too.
         */
        let removedVariantIndex = Infinity

        /**
         * Variant labels are inherited from the closest variant-controlling
         * ancestor.
         */
        let source = visualElement.parent
        while (source && !source.isControllingVariants) source = source.parent

        reversePriorityOrder.forEach((type, i) => {
            const typeState = state[type]
            const ownProp = props[type]
            const inheritedProp = source && source.props[type]
            const prop =
                ownProp !== undefined
                    ? ownProp
                    : isVariantLabel(inheritedProp) || inheritedProp === false
                    ? inheritedProp
                    : undefined
            const propIsVariant = isVariantLabel(prop)
            const activeDelta =
                type === changedActiveType ? typeState.isActive : null

            if (activeDelta === false) removedVariantIndex = i

            /**
             * Inherited labels are animated by the parent through
             * variantChildren, unless this element mounted after its parent.
             */
            const isInherited =
                propIsVariant &&
                ownProp === undefined &&
                !(isMounting && manuallyAnimateOnMount)

            typeState.protectedKeys = { ...encounteredKeys }

            if (
                (!typeState.isActive && activeDelta === null) ||
                (!prop && !typeState.prevProp) ||
                isAnimationControls(prop) ||
                typeof prop === "boolean"
            ) {
                return
            }

            /**
             * Don't re-resolve a running exit: a changed custom would start
             * new value animations that stop the originals, leaving the exit
             * promise unresolved and the element stuck in the DOM.
             */
            if (type === "exit" && typeState.isActive && activeDelta !== true) {
                encounteredKeys = {
                    ...encounteredKeys,
                    ...typeState.prevResolvedValues,
                }
                return
            }

            const variantDidChange = checkVariantsDidChange(
                typeState.prevProp,
                prop
            )
            let shouldAnimateType =
                variantDidChange ||
                (propIsVariant &&
                    ((activeDelta && !isInherited) || i > removedVariantIndex))
            let handledRemovedValues = false
            const definitionList = Array.isArray(prop) ? prop : [prop]
            let resolvedValues: { [key: string]: any } = {}

            if (activeDelta !== false) {
                for (const definition of definitionList) {
                    const { transition, transitionEnd, ...target } =
                        resolveVariant(
                            visualElement,
                            definition,
                            getTypeCustom(visualElement, type)
                        ) || {}
                    resolvedValues = {
                        ...resolvedValues,
                        ...target,
                        ...transitionEnd,
                    }
                }
            }

            const { prevResolvedValues } = typeState

            for (const key in { ...prevResolvedValues, ...resolvedValues }) {
                if (key in encounteredKeys) continue

                const next = resolvedValues[key]
                const prev = prevResolvedValues[key]

                /**
                 * Keyframes compare by value, but replay whenever the
                 * variant label changed.
                 */
                const valueHasChanged =
                    Array.isArray(next) && Array.isArray(prev)
                        ? !shallowCompare(next, prev) || variantDidChange
                        : next !== prev

                if (
                    valueHasChanged &&
                    (next === undefined || next === null)
                ) {
                    removedKeys.add(key)
                } else if (
                    valueHasChanged ||
                    (next !== undefined && removedKeys.has(key))
                ) {
                    shouldAnimateType = true
                    if (removedKeys.delete(key)) handledRemovedValues = true
                    typeState.needsAnimating[key] = true

                    const motionValue = visualElement.getValue(key)
                    if (motionValue) motionValue.liveStyle = false
                } else {
                    typeState.protectedKeys[key] = true
                }
            }

            typeState.prevProp = prop
            typeState.prevResolvedValues = resolvedValues

            if (typeState.isActive) {
                encounteredKeys = { ...encounteredKeys, ...resolvedValues }
            }

            if (
                shouldAnimateType &&
                (!(isInherited && variantDidChange) || handledRemovedValues)
            ) {
                for (const animation of definitionList) {
                    const options: VisualElementAnimationOptions = { type }

                    /**
                     * Elements that mount into an already-mounted parent
                     * animate themselves, staggered by the parent variant's
                     * delayChildren.
                     */
                    if (
                        typeof animation === "string" &&
                        isMounting &&
                        manuallyAnimateOnMount &&
                        parent?.enteringChildren
                    ) {
                        const delayChildren = resolveVariant(parent, animation)
                            ?.transition?.delayChildren

                        options.delay = calcChildStagger(
                            parent.enteringChildren,
                            visualElement,
                            delayChildren
                        )
                    }

                    animations.push({ animation, options })
                }
            }
        })

        /**
         * Removed values that no lower-priority type defines animate back to
         * initial, then style, then the value as first read. If initial no
         * longer defines a value it once did, it stays where it is.
         */
        if (removedKeys.size) {
            const { initial } = props
            const fallbackAnimation: { [key: string]: any } = {}
            const resolvedInitial =
                typeof initial !== "boolean" &&
                resolveVariant(
                    visualElement,
                    Array.isArray(initial) ? initial[0] : initial,
                    visualElement.presenceContext?.custom
                )

            if (resolvedInitial && resolvedInitial.transition) {
                fallbackAnimation.transition = resolvedInitial.transition
            }

            removedKeys.forEach((key) => {
                const motionValue = visualElement.getValue(key)
                if (motionValue) motionValue.liveStyle = true

                const fromInitial =
                    resolvedInitial && !Array.isArray(initial)
                        ? (resolvedInitial as any)[key]
                        : undefined
                const fromProps = visualElement.getBaseTargetFromProps(
                    props,
                    key
                )

                fallbackAnimation[key] =
                    (fromInitial !== undefined
                        ? fromInitial
                        : fromProps !== undefined && !isMotionValue(fromProps)
                        ? fromProps
                        : visualElement.initialValues[key] === undefined
                        ? visualElement.baseTarget[key]
                        : undefined) ?? null
            })

            animations.push({ animation: fallbackAnimation })
        }

        const blockAnimation =
            (isMounting && visualElement.blockInitialAnimation) ||
            (isInitialRender &&
                !manuallyAnimateOnMount &&
                (props.initial === false || props.initial === props.animate))

        isInitialRender = wasReset = false

        return !blockAnimation && animations.length
            ? animate(animations)
            : Promise.resolve()
    }

    /**
     * Change whether a certain animation type is active.
     */
    function setActive(type: AnimationType, isActive: boolean) {
        if (state[type].isActive === isActive) return Promise.resolve()

        visualElement.variantChildren?.forEach((child: any) =>
            child.animationState?.setActive(type, isActive)
        )

        state[type].isActive = isActive

        const animations = animateChanges(type)

        for (const key in state) {
            state[key as AnimationType].protectedKeys = {}
        }

        return animations
    }

    return {
        animateChanges,
        setActive,
        /**
         * Allows tests to inject a mocked animate function.
         * @internal
         */
        setAnimateFunction: (makeAnimator) => {
            animate = makeAnimator(visualElement)
        },
        getState: () => state,
        reset: () => {
            state = createState()
            wasReset = true
        },
    }
}

export function checkVariantsDidChange(prev: any, next: any) {
    if (typeof next === "string") {
        return next !== prev
    } else if (Array.isArray(next)) {
        return !shallowCompare(next, prev)
    }

    return false
}

export interface AnimationTypeState {
    isActive: boolean
    protectedKeys: { [key: string]: true }
    needsAnimating: { [key: string]: boolean }
    prevResolvedValues: { [key: string]: any }
    prevProp?: VariantLabels | TargetAndTransition
}

function createState() {
    const state = {} as { [K in AnimationType]: AnimationTypeState }

    for (const type of variantPriorityOrder) {
        state[type] = {
            isActive: type === "animate",
            protectedKeys: {},
            needsAnimating: {},
            prevResolvedValues: {},
        }
    }

    return state
}
