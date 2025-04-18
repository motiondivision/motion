import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { isGenerator } from "../../generators/utils/is-generator"
import { Transition } from "../../types"

export function applyGeneratorOptions({
    type,
    ...options
}: Transition): Transition {
    if (isGenerator(type) && supportsLinearEasing()) {
        return type.applyToOptions!(options)
    } else {
        options.duration ??= 300
        options.ease ??= "easeOut"
    }

    return options
}
