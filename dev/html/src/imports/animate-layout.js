import {
    LayoutAnimationBuilder,
    animate,
    frame,
    layoutAnimation,
    parseAnimateLayoutArgs,
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

export function runLayoutAnimation(
    scopeOrUpdateDom,
    updateDomOrOptions,
    options
) {
    if (typeof scopeOrUpdateDom === "function") {
        const transition = updateDomOrOptions
        if (transition) {
            layoutAnimation.add(transition)
        } else {
            layoutAnimation.add()
        }
        scopeOrUpdateDom()
        return layoutAnimation.play()
    }

    if (options) {
        layoutAnimation.add(scopeOrUpdateDom, options)
    } else {
        layoutAnimation.add(scopeOrUpdateDom)
    }
    updateDomOrOptions()
    return layoutAnimation.play()
}

window.AnimateLayout = {
    animateLayout: unstable_animateLayout,
    LayoutAnimationBuilder,
    layoutAnimation,
    runLayoutAnimation,
    frame,
    animate,
}
