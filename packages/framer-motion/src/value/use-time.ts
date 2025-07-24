"use client"

import { useAnimationFrame } from "../utils/use-animation-frame"
import { useMotionValue } from "./use-motion-value"

export function useTime() {
    const time = useMotionValue(0)
    useAnimationFrame((t) => time.set(t))
    return time
}
