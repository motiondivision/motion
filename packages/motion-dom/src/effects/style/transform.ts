import type { AnyResolvedKeyframe } from "../../animation/types"
import { transformValueTypes } from "../../value/types/maps/transform"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import type { MotionValueState } from "../MotionValueState"

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

export type TransformTemplate = (
    transform: Record<string, string>,
    generated: string
) => string

/**
 * Build a transform from `keys`, in `transformPropOrder`, reading each
 * with `read`. Shared by the style effect, which reads bound motion
 * values, and the initial render, which reads plain values.
 *
 * Returns `undefined` while every key is still waiting for its origin
 * to be read, so the transform it would be read from isn't overwritten.
 */
export function buildTransformFrom(
    keys: readonly string[],
    read: (key: string) => AnyResolvedKeyframe | undefined,
    transformTemplate?: TransformTemplate
) {
    let transform = ""
    const typed: Record<string, string> = {}
    let unresolved = keys.length

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const value = read(key)

        if (value === undefined) continue
        unresolved = 0

        const parsed = typeof value === "number" ? value : parseFloat(value)

        if (transformTemplate) {
            typed[key] = getValueAsType(value, transformValueTypes[key])
        }

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
    const pathRotation = read("pathRotation")
    if (pathRotation) {
        transform +=
            (transform && " ") +
            "rotate(" +
            getValueAsType(pathRotation, transformValueTypes.pathRotation) +
            ")"
    } else if (unresolved && !transformTemplate) {
        return
    }

    return transformTemplate
        ? transformTemplate(typed, transform)
        : transform || "none"
}

export const buildTransform = (state: MotionValueState) =>
    buildTransformFrom(
        state.transformKeys || [],
        (key) => state.get(key)?.get(),
        state.transformTemplate
    )
