import type { AnyResolvedKeyframe } from "motion-dom"

export type NativeValues = { [key: string]: AnyResolvedKeyframe }

/**
 * An animation's values sampled every `SAMPLE_INTERVAL` ms on the JS thread,
 * for the UI thread to play back. The same model Motion uses to hand
 * springs to WAAPI as `linear()` easing.
 */
export interface NativeTable {
    samples: AnyResolvedKeyframe[]
    /**
     * Length of the samples in ms. When `loopLength` is set, playback jumps
     * back by `loopLength` every time it passes `loopStart + loopLength`.
     */
    duration: number
    loopStart: number
    loopLength: number
}

/**
 * Where a NativeVisualElement renders: a store of values that the UI thread
 * turns into the view's style.
 */
export interface NativeHost {
    /**
     * Write values from the JS thread. Values currently played on the UI
     * thread are skipped.
     */
    write(values: NativeValues): void

    /**
     * Play a table on the UI thread, starting `offset` ms in. `onEnd` is
     * called when it reaches the end. Returns a function that stops it.
     */
    play(
        key: string,
        table: NativeTable,
        offset: number,
        onEnd: VoidFunction
    ): VoidFunction
}
