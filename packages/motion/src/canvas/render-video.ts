import {
    frameData,
    MotionGlobalConfig,
    processFrame,
    type AnimationPlaybackControls,
} from "framer-motion/dom"
import type { CanvasLayer } from "./layer"

/**
 * Receives each frame while the canvas holds it. `timestamp` and
 * `duration` are in seconds. Capture the canvas before returning, for
 * instance with `new VideoFrame(canvas)` or a mediabunny `CanvasSource`.
 * A returned promise is waited for before the next frame is rendered.
 */
export type VideoFrameCallback = (
    canvas: HTMLCanvasElement,
    timestamp: number,
    duration: number
) => void | Promise<unknown>

export interface RenderVideoOptions {
    onFrame: VideoFrameCallback

    /**
     * Frames per second. Defaults to `60`.
     */
    fps?: number

    /**
     * Seconds to render. Defaults to the animation's duration.
     */
    duration?: number

    signal?: AbortSignal
}

/**
 * Render a layer frame by frame, for exporting it as video. Each frame,
 * the animation (paused for the export) is seeked to the frame's time
 * and Motion's frameloop is stepped on to it, so everything else driven
 * by Motion, like other animations, frame callbacks and shader `uTime`,
 * keeps time too. The browser then paints the canvas, and `onFrame`
 * captures it in that same paint, so no frame is dropped or repeated
 * however long each takes to render or encode.
 *
 * ```javascript
 * const source = new CanvasSource(canvas, { codec: "vp9" })
 * await renderVideo(layer, timeline, {
 *     fps: 60,
 *     onFrame: (canvas, timestamp, duration) => source.add(timestamp, duration),
 * })
 * ```
 *
 * Resolves with the number of frames rendered. The animation stays
 * paused on its last frame.
 */
export async function renderVideo(
    layer: CanvasLayer,
    animation: AnimationPlaybackControls | null | undefined,
    {
        onFrame,
        fps = 60,
        duration = animation?.duration,
        signal,
    }: RenderVideoOptions
) {
    if (!layer.supported) {
        throw new Error("renderVideo() needs HTML-in-canvas support.")
    }

    if (!duration || !isFinite(duration)) {
        throw new Error("renderVideo() needs a finite duration.")
    }

    const total = Math.round(duration * fps)
    const isManual = MotionGlobalConfig.useManualTiming
    const start = frameData.timestamp

    /**
     * On a manual clock, Motion runs every animation in JS, including
     * those it would hand to the browser, so each follows processFrame().
     */
    MotionGlobalConfig.useManualTiming = true
    animation?.pause()

    try {
        for (let frame = 0; frame < total; frame++) {
            if (signal?.aborted) throw signal.reason || new Error("Aborted")

            const timestamp = frame / fps
            if (animation) animation.time = timestamp
            processFrame(start + timestamp * 1000)

            let pending: void | Promise<unknown> = undefined
            await new Promise<void>((resolve) => {
                const stop = layer.onRender(() => {
                    stop()
                    pending = onFrame(layer.canvas, timestamp, 1 / fps)
                    resolve()
                })
                layer.invalidate()
            })
            await pending
        }
    } finally {
        MotionGlobalConfig.useManualTiming = isManual
    }

    return total
}
