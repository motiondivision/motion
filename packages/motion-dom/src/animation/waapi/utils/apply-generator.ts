import { ValueTransition } from "../../../animation/types"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { isGenerator } from "../../generators/utils/is-generator"

export function applyGeneratorOptions({
    type,
    ...options
}: ValueTransition): ValueTransition {
    if (isGenerator(type) && supportsLinearEasing()) {
        return type.applyToOptions!(options)
    } else {
        options.duration ??= 300
        options.ease ??= "easeOut"
    }

    return options
}
