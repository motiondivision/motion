import { transformValueTypes } from "../../value/types/maps/transform"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState } from "../MotionValueState"

const translateAlias: Record<string, string> = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective",
}

/**
 * Cache of `translateX(`-style openers so each render is a few string
 * concatenations rather than a template per transform.
 */
const openers: Record<string, string> = {}

export function buildTransform(state: MotionValueState) {
    let transform = ""
    const { transformKeys: keys = [], transformValues: values = {} } = state

    /**
     * Loop over the bound transforms in order, adding the ones that
     * aren't at their default value to the transform string.
     */
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const value = values[key].get()

        if (value === undefined || value === "none") continue

        const parsed = typeof value === "number" ? value : parseFloat(value)

        if (parsed !== (key.startsWith("scale") ? 1 : 0)) {
            transform +=
                (transform && " ") +
                (openers[key] ||
                    (openers[key] = (translateAlias[key] || key) + "(")) +
                getValueAsType(value, transformValueTypes[key]) +
                ")"
        }
    }

    // See build-transform.ts: additive `rotate()` so user `rotate` isn't
    // clobbered. Not a `transformPropOrder` slot.
    const pathRotation = state.get("pathRotation")?.get()
    if (pathRotation) {
        transform +=
            (transform && " ") +
            "rotate(" +
            getValueAsType(pathRotation, transformValueTypes.pathRotation) +
            ")"
    }

    return transform || "none"
}
