import { processFrame, frameData } from "./frame"
import { time } from "./sync-time"

interface RenderFrameOptions {
    /**
     * The timestamp in milliseconds for this frame.
     * If not provided, you must provide `frame` and `fps`.
     */
    timestamp?: number

    /**
     * The frame number (0-indexed).
     * Used with `fps` to calculate the timestamp.
     * Useful for Remotion integration where you have a frame number.
     */
    frame?: number

    /**
     * Frames per second. Used with `frame` to calculate the timestamp.
     * @default 30
     */
    fps?: number

    /**
     * Time elapsed since the last frame in milliseconds.
     * If not provided, it will be calculated from the fps or default to 1000/60.
     */
    delta?: number
}

/**
 * Manually render a single animation frame.
 *
 * Use this with a custom driver (e.g., `remotionDriver` from `motion-remotion`)
 * to control animation timing externally. The custom driver prevents
 * requestAnimationFrame from auto-advancing animations.
 *
 * @example
 * // Set up custom driver first
 * import { remotionDriver } from 'motion-remotion'
 * MotionGlobalConfig.driver = remotionDriver
 *
 * // Then render frames manually
 * renderFrame({ timestamp: 1000 }) // Render at 1 second
 *
 * @example
 * // Using frame number (Remotion-style)
 * renderFrame({ frame: 30, fps: 30 }) // Render at frame 30 (1 second at 30fps)
 *
 * @example
 * // For Remotion, use the useRemotionFrame hook which handles this automatically
 * import { useRemotionFrame } from 'motion-remotion'
 */
export function renderFrame(options: RenderFrameOptions = {}): void {
    const { timestamp, frame, fps = 30, delta } = options

    let frameTimestamp: number
    let frameDelta: number

    if (timestamp !== undefined) {
        frameTimestamp = timestamp
        frameDelta = delta !== undefined ? delta : 1000 / 60
    } else if (frame !== undefined) {
        // Convert frame number to milliseconds
        frameTimestamp = (frame / fps) * 1000
        frameDelta = delta !== undefined ? delta : 1000 / fps
    } else {
        // Use current frameData timestamp + default delta if no timing info provided
        frameDelta = delta !== undefined ? delta : 1000 / 60
        frameTimestamp = frameData.timestamp + frameDelta
    }

    // Set the synchronized time
    time.set(frameTimestamp)

    // Process the frame - this runs all registered callbacks
    processFrame(frameTimestamp, frameDelta)
}
