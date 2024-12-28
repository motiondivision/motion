import { AnimationGeneratorType, GeneratorFactory } from "../../types"

export function isGenerator(
    type?: AnimationGeneratorType
): type is GeneratorFactory {
    return typeof type === "function"
}
