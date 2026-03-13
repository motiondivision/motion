import type { AnyResolvedKeyframe } from "../types"
import type { Transition } from "../types"

const orchestrationKeys = new Set([
    "when",
    "delay",
    "delayChildren",
    "staggerChildren",
    "staggerDirection",
    "repeat",
    "repeatType",
    "repeatDelay",
    "from",
    "elapsed",
])

/**
 * Decide whether a transition is defined on a given Transition.
 * This filters out orchestration options and returns true
 * if any options are left.
 */
export function isTransitionDefined(
    transition: Transition & { elapsed?: number; from?: AnyResolvedKeyframe }
) {
    for (const key in transition) {
        if (!orchestrationKeys.has(key)) return true
    }
    return false
}
