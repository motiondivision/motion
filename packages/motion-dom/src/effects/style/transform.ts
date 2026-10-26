import {
    isDefaultTransform,
    transformFunction,
} from "../../render/html/utils/build-transform"
import { MotionValueState } from "../MotionValueState"

export function buildTransform(state: MotionValueState) {
    let transform = ""
    const { transformKeys: keys = [], transformValues: values = {} } = state

    /**
     * Loop over the bound transforms in order, adding the ones that
     * aren't at their default value to the transform string.
     */
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const value = values[key].getCurrent()

        if (value === undefined) continue

        if (!isDefaultTransform(key, value)) {
            transform += (transform && " ") + transformFunction(key, value)
        }
    }

    // See build-transform.ts: additive `rotate()` so user `rotate` isn't
    // clobbered. Not a `transformPropOrder` slot.
    const pathRotation = state.get("pathRotation")?.get()
    if (pathRotation) {
        transform +=
            (transform && " ") + transformFunction("rotate", pathRotation)
    }

    return transform || "none"
}
