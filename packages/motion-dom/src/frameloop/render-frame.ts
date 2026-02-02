import { MotionGlobalConfig } from "motion-utils"
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
 * Use this in environments where `requestAnimationFrame` is unavailable
 * or when you need manual control over frame timing, such as:
 * - WebXR immersive sessions
 * - Remotion video rendering (use with motion-remotion package)
 * - Server-side rendering of animations
 * - Custom animation loops
 *
 * Note: For Remotion, use the `useRemotionFrame` hook from `motion-remotion`
 * which handles driver setup and frame synchronization automatically.
 *
 * @example
 * // Using timestamp directly
 * renderFrame({ timestamp: 1000 }) // Render at 1 second
 *
 * @example
 * // Using frame number
 * renderFrame({ frame: 30, fps: 30 }) // Render at frame 30 (1 second at 30fps)
 *
 * @example
 * // In a WebXR session
 * function onXRFrame(time, xrFrame) {
 *   renderFrame({ timestamp: time })
 *   // ... rest of XR frame logic
 * }
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

    // Temporarily enable manual timing mode during frame processing
    const previousManualTiming = MotionGlobalConfig.useManualTiming
    MotionGlobalConfig.useManualTiming = true

    // Set the synchronized time
    time.set(frameTimestamp)

    // Process the frame - this runs all registered callbacks
    processFrame(frameTimestamp, frameDelta)

    // Restore previous manual timing setting
    MotionGlobalConfig.useManualTiming = previousManualTiming
}

/**
 * Enable manual timing mode globally.
 * When enabled, animations will not auto-advance with requestAnimationFrame.
 * You must call `renderFrame()` to advance animations.
 *
 * For Remotion integration, use the `motion-remotion` package instead,
 * which provides a more complete solution with automatic WAAPI disabling.
 *
 * @example
 * // Enable manual timing for the entire session
 * setManualTiming(true)
 *
 * // Advance frames manually
 * renderFrame({ timestamp: 0 })
 * renderFrame({ timestamp: 16.67 })
 * renderFrame({ timestamp: 33.33 })
 */
export function setManualTiming(enabled: boolean): void {
    MotionGlobalConfig.useManualTiming = enabled
}

/**
 * Check if manual timing mode is currently enabled.
 */
export function isManualTiming(): boolean {
    return MotionGlobalConfig.useManualTiming === true
}
