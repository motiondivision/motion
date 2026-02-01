"use client"

import { renderFrame, setManualTiming } from "motion-dom"
import { useContext, useEffect, useRef } from "react"
import { MotionConfigContext } from "../context/MotionConfigContext"

interface UseManualFrameOptions {
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
 * A hook for manually controlling Motion animations based on a frame number.
 *
 * This is designed for integration with video rendering frameworks like Remotion,
 * or any environment where `requestAnimationFrame` is unavailable or
 * animations need to be driven by an external timing source.
 *
 * @example
 * // Basic usage with Remotion
 * import { useCurrentFrame, useVideoConfig } from 'remotion'
 * import { useManualFrame } from 'motion/react'
 *
 * function MyComponent() {
 *   const frame = useCurrentFrame()
 *   const { fps } = useVideoConfig()
 *
 *   // This syncs Motion animations to Remotion's frame
 *   useManualFrame({ frame, fps })
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
 * // With a custom frame source
 * function MyComponent({ frame }: { frame: number }) {
 *   useManualFrame({ frame, fps: 60 })
 *
 *   return (
 *     <motion.div
 *       animate={{ opacity: 1 }}
 *       initial={{ opacity: 0 }}
 *       transition={{ duration: 0.5 }}
 *     />
 *   )
 * }
 */
export function useManualFrame({ frame, fps = 30 }: UseManualFrameOptions) {
    const { isStatic } = useContext(MotionConfigContext)
    const prevFrame = useRef<number>(-1)
    const hasInitialized = useRef(false)

    // Enable manual timing on mount, disable on unmount
    useEffect(() => {
        if (isStatic) return

        setManualTiming(true)

        return () => {
            setManualTiming(false)
        }
    }, [isStatic])

    // Render the frame when it changes
    useEffect(() => {
        if (isStatic) return

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
    }, [frame, fps, isStatic])
}
