import {
    LayoutAnimationBuilder,
    frame,
    parseAnimateLayoutArgs,
    animate,
} from "framer-motion/dom"

export function unstable_animateLayout(
    scopeOrUpdateDom,
    updateDomOrOptions,
    options
) {
    const { scope, updateDom, defaultOptions } = parseAnimateLayoutArgs(
        scopeOrUpdateDom,
        updateDomOrOptions,
        options
    )

    return new LayoutAnimationBuilder(scope, updateDom, defaultOptions)
}

window.AnimateLayout = {
    animateLayout: unstable_animateLayout,
    LayoutAnimationBuilder,
    frame,
    animate,
}
