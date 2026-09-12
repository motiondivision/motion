import { sanitize } from "../../value/types/utils/sanitize"
import { getMixer } from "./complex"
import { mixNumber as mixNumberImmediate } from "./number"
import { Mixer } from "./types"

/**
 * A single number with an optional unit, e.g. "50%", "-10px", ".5em".
 * Exponents don't match, so they fall through to the complex mixer.
 */
const unitValue = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu

/**
 * Most CSS values Motion mixes are a single number with a unit. Mixing
 * these directly produces the same output as the complex mixer
 * ("25%", "0.33333px") without tokenising both strings.
 */
function mixUnit(from: string, to: string): Mixer<string> | undefined {
    const a = unitValue.exec(from)
    if (!a) return
    const b = unitValue.exec(to)
    if (!b || a[2] !== b[2]) return

    const unit = a[2]
    const origin = parseFloat(a[1])
    const target = parseFloat(b[1])

    return (p: number) =>
        sanitize(mixNumberImmediate(origin, target, p)) + unit
}

export function mix<T>(from: T, to: T): Mixer<T>
export function mix(from: number, to: number, p: number): number
export function mix<T>(from: T, to: T, p?: T): Mixer<T> | number {
    if (
        typeof from === "number" &&
        typeof to === "number" &&
        typeof p === "number"
    ) {
        return mixNumberImmediate(from, to, p)
    }

    if (typeof from === "string" && typeof to === "string") {
        const mixer = mixUnit(from, to)
        if (mixer) return mixer as Mixer<T>
    }

    const mixer = getMixer(from)
    return mixer(from as any, to as any) as Mixer<T>
}
