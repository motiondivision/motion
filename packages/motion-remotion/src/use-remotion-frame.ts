"use client"

import { renderFrame } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { useEffect, useLayoutEffect, useRef } from "react"
import { remotionDriver } from "./driver"

interface UseRemotionFrameOptions {
    /**
     * The current frame number (0-indexed).
     * Typically from Remotion's `useCurrentFrame()`.
     */
    frame: number

    /**
     * Frames per second of the video/animation.
     * Typically from Remotion's `useVideoConfig().fps`.
     * @default 30
     */
    fps?: number
}

/**
 * A hook for integrating Motion animations with Remotion's frame-based rendering.
 *
 * This hook:
 * 1. Sets a custom driver that disables requestAnimationFrame
 * 2. Disables WAAPI (which would use wall-clock time)
 * 3. Calls renderFrame() when the frame changes
 *
 * Place this hook at the root of your Remotion composition to sync all
 * Motion animations to Remotion's timeline.
 *
 * @example
 * import { useCurrentFrame, useVideoConfig } from 'remotion'
 * import { useRemotionFrame } from 'motion-remotion'
 *
 * function MyComposition() {
 *   const frame = useCurrentFrame()
 *   const { fps } = useVideoConfig()
 *
 *   // Sync Motion animations to Remotion's frame
 *   useRemotionFrame({ frame, fps })
 *
 *   return (
 *     <motion.div
 *       animate={{ x: 100 }}
 *       transition={{ duration: 1 }}
 *     />
 *   )
 * }
 *
 * @example
 * // Creating a reusable bridge component
 * function MotionBridge({ children }: { children: React.ReactNode }) {
 *   const frame = useCurrentFrame()
 *   const { fps } = useVideoConfig()
 *   useRemotionFrame({ frame, fps })
 *   return <>{children}</>
 * }
 */
export function useRemotionFrame({ frame, fps = 30 }: UseRemotionFrameOptions) {
    const prevFrame = useRef<number>(-1)
    const hasInitialized = useRef(false)

    // Set the global driver on mount, restore on unmount
    // Use layout effect to ensure driver is set before animations start
    useLayoutEffect(() => {
        const previousDriver = MotionGlobalConfig.driver
        MotionGlobalConfig.driver = remotionDriver

        return () => {
            MotionGlobalConfig.driver = previousDriver
        }
    }, [])

    // Render the frame when it changes
    useEffect(() => {
        // Only render if frame has changed or on first render
        if (frame !== prevFrame.current || !hasInitialized.current) {
            const delta =
                hasInitialized.current && prevFrame.current >= 0
                    ? ((frame - prevFrame.current) / fps) * 1000
                    : 1000 / fps

            renderFrame({ frame, fps, delta: Math.abs(delta) })

            prevFrame.current = frame
            hasInitialized.current = true
        }
    }, [frame, fps])
}
