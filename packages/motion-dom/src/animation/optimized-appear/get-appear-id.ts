import { optimizedAppearDataAttribute } from "./data-id"
import type { WithAppearProps } from "./types"

export function getOptimisedAppearId(
    visualElement: WithAppearProps
): string | undefined {
    return visualElement.props[optimizedAppearDataAttribute]
}
