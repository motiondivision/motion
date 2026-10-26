import type { Ref } from "react"

/**
 * Set a callback ref or ref object. Returns a callback ref's cleanup.
 */
export const setRef = <T>(ref: Ref<T> | undefined, value: T | null) =>
    typeof ref === "function"
        ? ref(value)
        : ref && ((ref as { current: T | null }).current = value)
