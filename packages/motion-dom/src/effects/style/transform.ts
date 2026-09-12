import { transformPropOrder } from "../../render/utils/keys-transform"
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
    const { latest } = state
    const keys = state.transformKeys || transformPropOrder

    // Translation-only states can express both axes in one CSS function.
    // Preserve the general path for ordering-sensitive mixed transforms.
    if (
        state.transformKeys &&
        keys.length <= 2 &&
        keys.length > 0 &&
        (keys[0] === "x" || keys[0] === "y") &&
        (keys.length === 1 || keys[1] === "x" || keys[1] === "y") &&
        !latest.pathRotation
    ) {
        const x = latest.x ?? 0
        const y = latest.y ?? 0
        const parsedX = typeof x === "number" ? x : parseFloat(x)
        const parsedY = typeof y === "number" ? y : parseFloat(y)
        if (parsedX === 0 && parsedY === 0) return "none"
        return (
            "translate(" +
            getValueAsType(x, transformValueTypes.x) +
            ", " +
            getValueAsType(y, transformValueTypes.y) +
            ")"
        )
    }

    /**
     * Loop over the bound transforms in order, adding the ones that
     * aren't at their default value to the transform string.
     */
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const value = latest[key]

        if (value === undefined) continue

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
    const pathRotation = latest.pathRotation
    if (pathRotation) {
        transform +=
            (transform && " ") +
            "rotate(" +
            getValueAsType(pathRotation, transformValueTypes.pathRotation) +
            ")"
    }

    return transform || "none"
}
