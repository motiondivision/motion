import { isObject } from "motion-utils"
import { MotionValue } from "../../value"
import type { MotionNode } from "../../node/MotionNode"
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
        state: MotionNode,
        key: string,
        value: MotionValue
    ) => {
        /**
         * Written as the value changes, so it's given the value. When
         * it's flushed instead, it reads the value itself.
         */
        return state.set(key, value, (latest = value.get()) => {
            subject[key] = latest
        })
    },
    {
        test: (subject: unknown): subject is PropSubject => isObject(subject),
        read: (subject, key) => {
            const value = subject[key]
            return typeof value === "string" || typeof value === "number"
                ? value
                : undefined
        },
        sync: true,
    }
)
