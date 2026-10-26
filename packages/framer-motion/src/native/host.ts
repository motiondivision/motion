import { runOnJS, runOnUI } from "react-native-reanimated"
import { playTable, stopTable, TokenStore, ValueStore, writeValues } from "./player"
import type { NativeHost, NativeValues } from "./types"

/**
 * The JS thread's side of a view's values. It keeps a copy of what it last
 * wrote, so only changed values cross to the UI thread, and skips values
 * the UI thread is playing.
 */
export function createNativeHost(
    store: ValueStore,
    tokens: TokenStore,
    initial: NativeValues
): NativeHost {
    const written: NativeValues = { ...initial }
    const playing: { [key: string]: number } = {}
    let id = 0

    return {
        write(values) {
            let changes: NativeValues | undefined

            for (const key in values) {
                const value = values[key]
                if (playing[key] || written[key] === value) continue

                written[key] = value
                ;(changes ||= {})[key] = value
            }

            changes && runOnUI(writeValues)(store, changes)
        },

        play(key, table, offset, onEnd) {
            const token = ++id
            playing[key] = token

            /**
             * The UI thread now owns the value, so the next write from JS
             * must go through even if it matches the last one.
             */
            delete written[key]

            runOnUI(playTable)(
                store,
                tokens,
                key,
                token,
                table,
                offset,
                () => {
                    if (playing[key] !== token) return
                    delete playing[key]
                    onEnd()
                },
                runOnJS
            )

            return () => {
                if (playing[key] !== token) return
                delete playing[key]
                runOnUI(stopTable)(tokens, key, token)
            }
        },
    }
}
