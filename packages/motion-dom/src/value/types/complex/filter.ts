import { complex } from "."
import { floatRegex } from "../utils/float-regex"

/**
 * Properties that should default to 1 or 100%
 */
const maxDefaults = new Set(["brightness", "contrast", "saturate", "opacity"])

function applyDefaultFilter(v: string) {
    const [name, value] = v.slice(0, -1).split("(")

    if (name === "drop-shadow") return v

    const [number] = value.match(floatRegex) || []
    if (!number) return v

    const unit = value.replace(number, "")
    let defaultValue = maxDefaults.has(name) ? 1 : 0
    if (number !== value) defaultValue *= 100

    return name + "(" + defaultValue + unit + ")"
}

const functionRegex = /\b([a-z-]*)\(.*?\)/gu

export const filter = {
    ...complex,
    getAnimatableNone: (v: string) => {
        const functions = v.match(functionRegex)
        return functions ? functions.map(applyDefaultFilter).join(" ") : v
    },
}
