import { optimizedAppearDataAttribute } from "./data-id"
import type { WithAppearProps } from "./types"

/**
 * The elements whose enter animations are running as CSS. Each is its
 * own id, so it needs no attribute.
 */
export const appearElements = /*@__PURE__*/ new WeakSet<object>()

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
