import type { AnyResolvedKeyframe } from "motion-dom"
import type { NativeTable, NativeValues } from "./types"

/**
 * These functions run on React Native's UI thread as worklets. They can be
 * called from JS too, which is how they're tested.
 */

interface Store<V> {
    value: V
    modify(modifier: (value: V) => V): void
}

export type ValueStore = Store<NativeValues>

/**
 * The UI thread's record of which table owns each key.
 */
export type TokenStore = Store<{ [key: string]: number }>

/**
 * The value of a table `elapsed` ms in, and whether it has finished.
 */
export function sampleTable(
    { samples, duration, loopStart, loopLength }: NativeTable,
    elapsed: number
): [AnyResolvedKeyframe, boolean] {
    "worklet"
    let done = false

    if (loopLength) {
        if (elapsed > loopStart) {
            elapsed = loopStart + ((elapsed - loopStart) % loopLength)
        }
    } else if (elapsed >= duration) {
        elapsed = duration
        done = true
    }

    const last = samples.length - 1
    const progress = Math.max(0, (elapsed / duration) * last)
    const index = Math.min(Math.floor(progress), last)
    const from = samples[index]

    /**
     * Numbers are interpolated between samples. Anything else, like a
     * colour, steps between them, which at the sample rate is finer than a
     * frame.
     */
    const value =
        typeof from === "number" && index < last
            ? from + ((samples[index + 1] as number) - from) * (progress - index)
            : samples[Math.round(progress)]

    return [value, done]
}

export function writeValues(store: ValueStore, values: NativeValues) {
    "worklet"
    store.modify((latest) => {
        "worklet"
        for (const key in values) latest[key] = values[key]
        return latest
    })
}

export function playTable(
    store: ValueStore,
    tokens: TokenStore,
    key: string,
    token: number,
    table: NativeTable,
    offset: number,
    onEnd: VoidFunction,
    /**
     * Reanimated's runOnJS, passed in rather than imported so bundlers
     * can't turn it into a property of the whole module, which the worklet
     * would then capture.
     */
    runOnJS: (fn: VoidFunction) => VoidFunction
) {
    "worklet"
    tokens.value[key] = token

    let startTime = -1
    const step = (timestamp: number) => {
        if (tokens.value[key] !== token) return

        if (startTime < 0) startTime = timestamp - offset

        const [value, done] = sampleTable(table, timestamp - startTime)

        store.modify((latest) => {
            "worklet"
            latest[key] = value
            return latest
        })

        if (done) {
            tokens.value[key] = 0
            runOnJS(onEnd)()
        } else {
            requestAnimationFrame(step)
        }
    }

    requestAnimationFrame(step)
}

export function stopTable(tokens: TokenStore, key: string, token: number) {
    "worklet"
    if (tokens.value[key] === token) tokens.value[key] = 0
}
