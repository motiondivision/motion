import { getMixer } from "./complex"
import { mixNumber as mixNumberImmediate } from "./number"
import { Mixer } from "./types"

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

    const mixer = getMixer(from)
    return mixer(from as any, to as any) as Mixer<T>
}
