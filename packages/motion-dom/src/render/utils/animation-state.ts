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
export type AnimateFunction = (
    animations: DefinitionAndOptions[]
) => Promise<any>

const reversePriorityOrder = [...variantPriorityOrder].reverse()

/**
 * The transition a value uses when it leaves a state (#1725): the state's
 * own transition when `out: true`, or the `out` transition itself.
 * Value-specific keys are resolved by animateTarget.
 */
const getOutTransition = (transition: any) =>
    transition?.out === true ? transition : transition?.out

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
        const { initial } = props
        const isMounting = isInitialRender || wasReset
        const animations: DefinitionAndOptions[] = []
        const resolveInitial = (definition = initial) =>
            (typeof definition !== "boolean" &&
                resolveVariant(
                    visualElement,
                    Array.isArray(definition) ? definition[0] : definition,
                    visualElement.presenceContext?.custom
                )) ||
            undefined

        /**
         * Values removed from a type, mapped to the out transition of the
         * state they're leaving. A lower-priority type that defines them
         * animates them back, otherwise they fall back to a base target.
         */
        const removedKeys = new Map<string, any>()

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
         * ancestor, unless an element on the way has inherit={false}.
         */
        let source = visualElement
        do source = source.props.inherit !== false && source.parent
        while (source && !source.isControllingVariants)

        /**
         * Mounting leaves initial, so values use its out transition. Like the
         * other types, variant children inherit initial's label.
         */
        const initialOut =
            isMounting &&
            getOutTransition(
                resolveInitial(initial ?? (source && source.props.initial))
                    ?.transition
            )

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
             * Set after the skip above, so deactivating a type that has nothing
             * to animate (e.g. whileTap with no prop) doesn't re-run the variants
             * below it.
             */
            if (activeDelta === false) removedVariantIndex = i

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
            let out: any

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
                    /**
                     * One out transition per type. With a list of labels,
                     * the last one that sets out applies to all its values.
                     */
                    out = getOutTransition(transition) || out
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

                let outTransition

                if (valueHasChanged && (next === undefined || next === null)) {
                    /**
                     * The highest-priority state a value leaves wins.
                     */
                    removedKeys.has(key) ||
                        removedKeys.set(key, typeState.prevOut)
                } else if (
                    valueHasChanged ||
                    (next !== undefined && removedKeys.has(key))
                ) {
                    shouldAnimateType = true
                    outTransition = removedKeys.get(key) || initialOut
                    if (removedKeys.delete(key)) handledRemovedValues = true
                    typeState.needsAnimating[key] = true

                    const motionValue = visualElement.getValue(key)
                    if (motionValue) motionValue.liveStyle = false
                } else {
                    typeState.protectedKeys[key] = true
                }

                typeState.out[key] = outTransition
            }

            typeState.prevProp = prop
            typeState.prevResolvedValues = resolvedValues
            typeState.prevOut = out

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
            const fallbackAnimation: { [key: string]: any } = {}
            const resolvedInitial = resolveInitial()
            let fallbackTransition = resolvedInitial?.transition

            removedKeys.forEach((outTransition, key) => {
                if (outTransition) {
                    fallbackTransition = {
                        ...(fallbackTransition ||
                            visualElement.getDefaultTransition()),
                        [key]: outTransition,
                    }
                }

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

                /**
                 * If it stays where it is, that's now its base. Otherwise a
                 * later removal (like a gesture ending) would also stay,
                 * leaving the value stuck. Stop first so accelerated
                 * animations sync the value they reached. In practice initial
                 * only changes like this with Fast Refresh, so this is
                 * dev-only (#3787).
                 */
                if (
                    process.env.NODE_ENV !== "production" &&
                    fallbackAnimation[key] === null &&
                    visualElement.initialValues[key] !== undefined
                ) {
                    delete visualElement.initialValues[key]
                    motionValue?.stop()
                    visualElement.baseTarget[key] = motionValue?.get()
                }
            })

            if (fallbackTransition) {
                fallbackAnimation.transition = fallbackTransition
            }
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
    /**
     * The out transition of prevProp (#1725).
     */
    prevOut?: any
    /**
     * Out transitions of the states that values flagged in needsAnimating
     * are leaving (#1725).
     */
    out: { [key: string]: any }
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
            out: {},
        }
    }

    return state
}
