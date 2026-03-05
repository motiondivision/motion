import { invariant } from "../../errors"
import { noop } from "../../noop"
import { anticipate } from "../anticipate"
import { backIn, backInOut, backOut } from "../back"
import { circIn, circInOut, circOut } from "../circ"
import { cubicBezier } from "../cubic-bezier"
import { easeIn, easeInOut, easeOut } from "../ease"
import { Easing, EasingFunction, NativeEasing } from "../types"
import { isBezierDefinition } from "./is-bezier-definition"

export const isNativeEasing = (
    easing: Easing | Easing[]
): easing is NativeEasing =>
    typeof easing === "object" &&
    !Array.isArray(easing) &&
    "native" in easing

const easingLookup = {
    linear: noop,
    easeIn,
    easeInOut,
    easeOut,
    circIn,
    circInOut,
    circOut,
    backIn,
    backInOut,
    backOut,
    anticipate,
}

const isValidEasing = (easing: Easing): easing is keyof typeof easingLookup => {
    return typeof easing === "string"
}

export const easingDefinitionToFunction = (
    definition: Easing
): EasingFunction => {
    if (isNativeEasing(definition)) {
        return noop
    } else if (isBezierDefinition(definition)) {
        // If cubic bezier definition, create bezier curve
        invariant(
            definition.length === 4,
            `Cubic bezier arrays must contain four numerical values.`,
            "cubic-bezier-length"
        )

        const [x1, y1, x2, y2] = definition
        return cubicBezier(x1, y1, x2, y2)
    } else if (isValidEasing(definition)) {
        // Else lookup from table
        invariant(
            easingLookup[definition] !== undefined,
            `Invalid easing type '${definition}'`,
            "invalid-easing-type"
        )
        return easingLookup[definition]
    }

    return definition
}
