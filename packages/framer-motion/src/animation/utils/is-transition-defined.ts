import type { Transition } from "motion-dom"

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
    ...transition
}: Transition & { elapsed?: number; from?: string | number }) {
    return !!Object.keys(transition).length
}
