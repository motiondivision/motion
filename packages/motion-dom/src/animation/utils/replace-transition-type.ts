import { inertia } from "../generators/inertia"
import { keyframes } from "../generators/keyframes"
import { spring } from "../generators/spring"
import { GeneratorFactory, ValueAnimationTransition } from "../types"

const transitionTypeMap: { [key: string]: GeneratorFactory } = {
    decay: inertia,
    inertia,
    tween: keyframes,
    keyframes: keyframes,
    spring,
}

export function replaceTransitionType(transition: ValueAnimationTransition) {
    if (typeof transition.type === "string") {
        transition.type = transitionTypeMap[transition.type]
    }
}
