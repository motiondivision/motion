import { isObject } from "motion-utils"
import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"
import { createEffect } from "../utils/create-effect"

interface PropSubject {
    [key: string]: any
}

/**
 * Writes motion values to the properties of any object. This is
 * animate()'s fallback for subjects no registered effect claims.
 */
export const propEffect = /*@__PURE__*/ createEffect(
    (
        subject: PropSubject,
        state: MotionValueState,
        key: string,
        value: MotionValue
    ) => {
        return state.set(
            key,
            value,
            () => {
                subject[key] = state.latest[key]
            },
            undefined,
            false
        )
    },
    {
        test: (subject: unknown): subject is PropSubject => isObject(subject),
        read: (subject, key) => {
            const value = subject[key]
            return typeof value === "string" || typeof value === "number"
                ? value
                : undefined
        },
    }
)
