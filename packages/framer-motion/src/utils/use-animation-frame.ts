"use client"

import { cancelFrame, frame, FrameData } from "motion-dom"
import { useContext, useEffect, useRef } from "react"
import { MotionConfigContext } from "../context/MotionConfigContext"

export type FrameCallback = (timestamp: number, delta: number) => void

export function useAnimationFrame(callback: FrameCallback) {
    const initialTimestamp = useRef(0)
    const { isStatic } = useContext(MotionConfigContext)

    useEffect(() => {
        if (isStatic) return

        const provideTimeSinceStart = ({ timestamp, delta }: FrameData) => {
            if (!initialTimestamp.current) initialTimestamp.current = timestamp

            callback(timestamp - initialTimestamp.current, delta)
        }

        frame.update(provideTimeSinceStart, true)
        return () => cancelFrame(provideTimeSinceStart)
    }, [callback])
}
