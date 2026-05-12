"use client"

import { useContext } from "react"
import {
    MotionConfigContext,
    ReducedMotionConfig,
} from "../../context/MotionConfigContext"
import { useReducedMotion } from "./use-reduced-motion"

export function useReducedMotionConfig(override?: ReducedMotionConfig) {
    const reducedMotionPreference = useReducedMotion()
    const { reducedMotion: contextReducedMotion } =
        useContext(MotionConfigContext)
    const reducedMotion = override ?? contextReducedMotion

    if (reducedMotion === "never") {
        return false
    } else if (reducedMotion === "always") {
        return true
    } else {
        return reducedMotionPreference
    }
}
