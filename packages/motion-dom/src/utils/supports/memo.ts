import { memo } from "motion-utils"
import { supportsFlags } from "./flags"

export function memoSupports<T extends any>(
    callback: () => T,
    supportsFlag: keyof typeof supportsFlags
) {
    const memoized = memo(callback)
    return () => supportsFlags[supportsFlag] ?? memoized()
}
