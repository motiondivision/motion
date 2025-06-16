import type {
    AnimationDefinition,
    TargetAndTransition,
    TargetResolver,
} from "motion-dom"
import type { MotionProps } from "../../motion/types"
import { VisualElement } from "../VisualElement"
import type { ResolvedValues } from "../types"

function getValueState(
    visualElement?: VisualElement
): [ResolvedValues, ResolvedValues] {
    const state: [ResolvedValues, ResolvedValues] = [{}, {}]

    visualElement?.values.forEach((value, key) => {
        state[0][key] = value.get()
        state[1][key] = value.getVelocity()
    })

    return state
}

export function resolveVariantFromProps(
    props: MotionProps,
    definition: TargetAndTransition | TargetResolver,
    custom?: any,
    visualElement?: VisualElement
): TargetAndTransition
export function resolveVariantFromProps(
    props: MotionProps,
    definition?: AnimationDefinition,
    custom?: any,
    visualElement?: VisualElement
): undefined | TargetAndTransition
export function resolveVariantFromProps(
    props: MotionProps,
    definition?: AnimationDefinition,
    custom?: any,
    visualElement?: VisualElement
) {
    /**
     * If the variant definition is a function, resolve.
     */
    if (typeof definition === "function") {
        const [current, velocity] = getValueState(visualElement)
        definition = definition(
            custom !== undefined ? custom : props.custom,
            current,
            velocity
        )
    }

    /**
     * If the variant definition is a variant label, or
     * the function returned a variant label, resolve.
     */
    if (typeof definition === "string") {
        definition = props.variants && props.variants[definition]
    }

    /**
     * At this point we've resolved both functions and variant labels,
     * but the resolved variant label might itself have been a function.
     * If so, resolve. This can only have returned a valid target object.
     */
    if (typeof definition === "function") {
        const [current, velocity] = getValueState(visualElement)
        definition = definition(
            custom !== undefined ? custom : props.custom,
            current,
            velocity
        )
    }

    return definition
}
