import { FeatureLoaders } from "../../../motion/features/types"

/**
 * The feature packages a motion component can fetch. Each import() is a
 * split point, so a bundler emits each package as its own chunk and an app
 * only downloads the ones its props use.
 *
 * Animations and gestures aren't here. A component has them from the
 * start, as an animation or gesture can begin before a fetch could finish.
 */
export const featureLoaders: FeatureLoaders = {
    layout: {
        keys: ["layout"],
        load: () =>
            import("../../../motion/features/layout").then((m) => m.layout),
    },
    drag: {
        keys: ["drag", "pan"],
        load: () =>
            import("../../../motion/features/drag").then((m) => m.drag),
    },
}
