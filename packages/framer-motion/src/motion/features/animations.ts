import { AnimationFeature } from "./animation"
import { FeaturePackages } from "./types"

/**
 * The exit feature isn't here: AnimatePresence provides it through
 * PresenceContext, so only apps that use AnimatePresence bundle it.
 */
export const animations: FeaturePackages = {
    animation: {
        Feature: AnimationFeature,
    },
}
