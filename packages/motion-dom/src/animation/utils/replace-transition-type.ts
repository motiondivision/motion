const generators: { [key: string]: GeneratorFactory } = {
    decay: inertia,
    inertia,
    tween: keyframesGeneratorFactory,
    keyframes: keyframesGeneratorFactory,
    spring,
}

export function replaceTransitionType(transition: ValueAnimationTransition) {
    if (typeof transition.type === "string") {
        transition.type = transitionTypeMap[transition.type]
    }
}
