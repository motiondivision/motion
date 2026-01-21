import type { AnyResolvedKeyframe } from "../types"
import type { Transition } from "../types"

/**
 * Decide whether a transition is defined on a given Transition.
 * This filters out orchestration options and returns true
 * if any options are left.
 */
export function isTransitionDefined({
    when,
    delay: _delay,
    delayChildren,
    staggerChildren,
    staggerDirection,
    repeat,
    repeatType,
    repeatDelay,
    from,
    elapsed,
    onDelayComplete: _onDelayComplete,
    ...transition
}: Transition & { elapsed?: number; from?: AnyResolvedKeyframe; onDelayComplete?: () => void }) {
    return !!Object.keys(transition).length
}
