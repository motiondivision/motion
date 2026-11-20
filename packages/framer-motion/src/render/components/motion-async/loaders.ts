import { FeatureLoaders } from "../../../motion/features/types"

/**
 * The four feature packages a motion component can fetch. Each import()
 * is a split point, so a bundler emits each package as its own chunk and
 * an app only downloads the ones its props use.
 */
export const featureLoaders: FeatureLoaders = {
    animation: {
        keys: ["animation"],
        load: () =>
            import("../../../motion/features/animations").then(
                (m) => m.animations
            ),
    },
    gestures: {
        keys: ["hover", "tap", "focus", "inView"],
        load: () =>
            import("../../../motion/features/gestures").then(
                (m) => m.gestureAnimations
            ),
    },
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
