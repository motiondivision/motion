import type { Ref } from "react"

/**
 * A callback ref that sets our own `ref` and an external one, a callback
 * ref or ref object. A callback ref's cleanup is called instead of the ref
 * with null, so it's returned wrapped to clear our own ref too.
 */
export const mergeRefs =
    <T>(ref: { current: T | null }, externalRef?: Ref<T>) =>
    (value: T | null) => {
        ref.current = value
        const cleanup =
            typeof externalRef === "function"
                ? externalRef(value)
                : externalRef &&
                  ((externalRef as { current: T | null }).current = value)

        if (typeof cleanup === "function") {
            return () => {
                ref.current = null
                cleanup()
            }
        }
    }
