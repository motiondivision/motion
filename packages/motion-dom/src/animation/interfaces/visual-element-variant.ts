import {
    getTypeCustom,
    resolveVariant,
} from "../../render/utils/resolve-dynamic-variants"
import { calcChildStagger } from "../utils/calc-child-stagger"
import type { VisualElementAnimationOptions } from "./types"
import { animateTarget } from "./visual-element-target"
import type { VisualElement } from "../../render/VisualElement"

export function animateVariant(
    visualElement: VisualElement,
    variant: string,
    options: VisualElementAnimationOptions = {}
): Promise<any> {
    const resolved = resolveVariant(
        visualElement,
        variant,
        getTypeCustom(visualElement, options.type)
    )

    const transition =
        options.transitionOverride ||
        (resolved?.transition ?? (visualElement.getDefaultTransition() || {}))

    const getAnimation = () =>
        Promise.all(
            resolved ? animateTarget(visualElement, resolved, options) : []
        )

    const getChildAnimations = (delay = 0) => {
        const { variantChildren } = visualElement
        const {
            delayChildren = 0,
            staggerChildren,
            staggerDirection,
        } = transition
        const animations: Promise<any>[] = []

        variantChildren?.forEach((child) => {
            child.notify("AnimationStart", variant)
            animations.push(
                animateVariant(child, variant, {
                    ...options,
                    delay:
                        delay +
                        (typeof delayChildren === "function"
                            ? 0
                            : delayChildren) +
                        calcChildStagger(
                            variantChildren,
                            child,
                            delayChildren,
                            staggerChildren,
                            staggerDirection
                        ),
                }).then(() => child.notify("AnimationComplete", variant))
            )
        })

        return Promise.all(animations)
    }

    /**
     * when: "beforeChildren" | "afterChildren" runs this element's animation
     * and its children's in sequence.
     */
    const { when } = transition

    return when
        ? when === "beforeChildren"
            ? getAnimation().then(() => getChildAnimations())
            : getChildAnimations().then(getAnimation)
        : Promise.all([getAnimation(), getChildAnimations(options.delay)])
}
