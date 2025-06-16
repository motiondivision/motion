import { MotionValue } from "."
import { cancelFrame, frame } from "../frameloop"

export function subscribeValue<O>(
    inputValues: MotionValue[],
    outputValue: MotionValue<O>,
    getLatest: () => O
) {
    const update = () => outputValue.set(getLatest())
    const scheduleUpdate = () => frame.preRender(update, false, true)

    const subscriptions = inputValues.map((v) => v.on("change", scheduleUpdate))

    outputValue.on("destroy", () => {
        subscriptions.forEach((unsubscribe) => unsubscribe())
        cancelFrame(update)
    })
}
