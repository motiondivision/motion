import { ScrollOptionsWithDefaults } from "../types"

/**
 * Currently, we only support element tracking with `scrollInfo`, though in
 * the future we can also offer ViewTimeline support.
 */
export function isElementTracking(options?: ScrollOptionsWithDefaults) {
    return options && (options.target || options.offset)
}
