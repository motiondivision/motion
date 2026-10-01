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
    const resolveFunction = (def: any) =>
        typeof def === "function"
            ? def(
                  custom !== undefined ? custom : props.custom,
                  ...getValueState(visualElement)
              )
            : def

    /**
     * Resolve a function, then a variant label (which the function may have
     * returned), then a function again as the label may point to one. The
     * final function can only return a target object.
     */
    definition = resolveFunction(definition)

    if (typeof definition === "string") {
        definition = props.variants && props.variants[definition]
    }

    return resolveFunction(definition)
}
