import { scaleCorrectors } from "../../render/utils/is-forced-motion-value"
import { withSharedLayout } from "../shared/shared-layout"
import { defaultScaleCorrectors } from "../styles/default-scale-correctors"
import {
    cleanDirtyNodes,
    createBasicProjectionNode,
    mixAxis,
    mixBox,
    propagateDirtyNodes,
} from "./create-basic-projection-node"
import type { ProjectionNodeConfig } from "./types"

export {
    cleanDirtyNodes,
    createBasicProjectionNode,
    mixAxis,
    mixBox,
    propagateDirtyNodes,
}

/**
 * Create a full projection node class with shared-element (`layoutId`,
 * `NodeStack`, `mixValues` crossfade) and default scale correctors
 * (`borderRadius`, `boxShadow`) enabled.
 */
export function createProjectionNode<I>(config: ProjectionNodeConfig<I>) {
    /**
     * Correctors registered via addScaleCorrector before projection loaded
     * (e.g. with an async LazyMotion bundle) take precedence over the defaults.
     * Applied here rather than at module scope so bundlers can drop projection
     * when it's unused.
     */
    for (const key in defaultScaleCorrectors) {
        if (!scaleCorrectors[key]) {
            scaleCorrectors[key] = defaultScaleCorrectors[key]
        }
    }

    return withSharedLayout(createBasicProjectionNode<I>(config))
}
