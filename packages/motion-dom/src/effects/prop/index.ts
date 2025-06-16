import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"
import { createEffect } from "../utils/create-effect"

export const propEffect = /*@__PURE__*/ createEffect(
    (
        subject: { [key: string]: any },
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
    }
)
