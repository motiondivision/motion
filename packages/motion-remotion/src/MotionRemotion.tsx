"use client"

import { renderFrame } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { ReactNode, useEffect, useInsertionEffect, useRef } from "react"
import { useCurrentFrame, useVideoConfig } from "remotion"
import { remotionDriver } from "./driver"

/**
 * Wrap your Remotion composition with this component to sync
 * Motion animations to Remotion's frame-based timeline.
 *
 * @example
 * function MyComposition() {
 *   return (
 *     <MotionRemotion>
 *       <motion.div animate={{ x: 100 }} transition={{ duration: 1 }} />
 *     </MotionRemotion>
 *   )
 * }
 */
export function MotionRemotion({ children }: { children: ReactNode }) {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const prevFrame = useRef<number>(-1)
    const hasInitialized = useRef(false)

    // Set the driver before any animations mount
    useInsertionEffect(() => {
        const previousDriver = MotionGlobalConfig.driver
        MotionGlobalConfig.driver = remotionDriver

        return () => {
            MotionGlobalConfig.driver = previousDriver
        }
    }, [])

    // Render frame when it changes
    useEffect(() => {
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

    return <>{children}</>
}
