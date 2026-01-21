import { resolveVariant } from "../../render/utils/resolve-dynamic-variants"
import { calcChildStagger } from "../utils/calc-child-stagger"
import type { VisualElementAnimationOptions } from "./types"
import { animateTarget } from "./visual-element-target"
import type { DynamicOption } from "../types"
import type { VisualElement } from "../../render/VisualElement"

export function animateVariant(
    visualElement: VisualElement,
    variant: string,
    options: VisualElementAnimationOptions = {}
): Promise<any> {
    const resolved = resolveVariant(
        visualElement,
        variant,
        options.type === "exit"
            ? visualElement.presenceContext?.custom
            : undefined
    )

    let { transition = visualElement.getDefaultTransition() || {} } =
        resolved || {}

    if (options.transitionOverride) {
        transition = options.transitionOverride
    }

    /**
     * If we have a variant, create a callback that runs it as an animation.
     * Otherwise, we resolve a Promise immediately for a composable no-op.
     */
    const getAnimation: () => Promise<any> = resolved
        ? () => Promise.all(animateTarget(visualElement, resolved, options))
        : () => Promise.resolve()

    /**
     * If we have children, create a callback that runs all their animations.
     * Otherwise, we resolve a Promise immediately for a composable no-op.
     */
    const getChildAnimations =
        visualElement.variantChildren && visualElement.variantChildren.size
            ? (forwardDelay = 0) => {
                  const {
                      delayChildren = 0,
                      staggerChildren,
                      staggerDirection,
                  } = transition

                  return animateChildren(
                      visualElement,
                      variant,
                      forwardDelay,
                      delayChildren,
                      staggerChildren,
                      staggerDirection,
                      options
                  )
              }
            : () => Promise.resolve()

    /**
     * If the transition explicitly defines a "when" option, we need to resolve either
     * this animation or all children animations before playing the other.
     */
    const { when } = transition
    if (when) {
        const [first, last] =
            when === "beforeChildren"
                ? [getAnimation, getChildAnimations]
                : [getChildAnimations, getAnimation]

        return first().then(() => last())
    } else {
        return Promise.all([getAnimation(), getChildAnimations(options.delay)])
    }
}

function animateChildren(
    visualElement: VisualElement,
    variant: string,
    delay: number = 0,
    delayChildren: number | DynamicOption<number> = 0,
    staggerChildren = 0,
    staggerDirection = 1,
    options: VisualElementAnimationOptions
) {
    const animations: Promise<any>[] = []

    // Don't pass parent's onDelayComplete to children - each child gets its own
    const { onDelayComplete: _parentOnDelayComplete, ...childOptions } = options

    for (const child of visualElement.variantChildren!) {
        child.notify("AnimationStart", variant)

        // Create onDelayComplete callback for this specific child
        const onDelayComplete = () => {
            child.notify("AnimationPlay", variant)
        }

        animations.push(
            animateVariant(child, variant, {
                ...childOptions,
                onDelayComplete,
                delay:
                    delay +
                    (typeof delayChildren === "function" ? 0 : delayChildren) +
                    calcChildStagger(
                        visualElement.variantChildren!,
                        child,
                        delayChildren,
                        staggerChildren,
                        staggerDirection
                    ),
            }).then(() => child.notify("AnimationComplete", variant))
        )
    }

    return Promise.all(animations)
}
