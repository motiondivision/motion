import type {
    AnimationDefinition,
    MotionNodeOptions,
    TargetAndTransition,
    TargetResolver,
} from "../../node/types"
import type { ResolvedValues } from "../types"

function getValueState(visualElement?: any): [ResolvedValues, ResolvedValues] {
    const state: [ResolvedValues, ResolvedValues] = [{}, {}]

    visualElement?.values.forEach((value: any, key: string) => {
        state[0][key] = value.get()
        state[1][key] = value.getVelocity()
    })

    return state
}

export function resolveVariantFromProps(
    props: MotionNodeOptions,
    definition: TargetAndTransition | TargetResolver,
    custom?: any,
    visualElement?: any
): TargetAndTransition
export function resolveVariantFromProps(
    props: MotionNodeOptions,
    definition?: AnimationDefinition,
    custom?: any,
    visualElement?: any
): undefined | TargetAndTransition
export function resolveVariantFromProps(
    props: MotionNodeOptions,
    definition?: AnimationDefinition,
    custom?: any,
    visualElement?: any
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
