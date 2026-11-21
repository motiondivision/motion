import type { StartAnimation } from "../../value"
import { optimizedAppearDataAttribute } from "./data-id"
import type { WithAppearProps } from "./types"

/**
 * The elements whose enter animations are running as CSS, each with a
 * description of those animations. An element is its own id, so it needs
 * no attribute.
 */
export const appearElements = /*@__PURE__*/ new WeakMap<object, unknown>()

/**
 * Set by the code that knows how to follow a CSS enter animation. Given a
 * value the animation code is about to animate, it returns an animation
 * that leaves the CSS animation running, or nothing.
 */
export const appearHandoff: {
    current?: (
        visualElement: any,
        key: string,
        value: any,
        target: unknown,
        transition: any
    ) => StartAnimation | undefined
} = {}

export function getOptimisedAppearId(
    visualElement: WithAppearProps
): string | undefined {
    const { current } = visualElement as { current?: object }

    return (
        visualElement.props[optimizedAppearDataAttribute] ||
        ((appearElements.has(current!) && current) as any) ||
        undefined
    )
}
