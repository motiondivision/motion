"use client"

import { useContext } from "react"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { useReducedMotion } from "./use-reduced-motion"

export function useReducedMotionConfig() {
    const reducedMotionPreference = useReducedMotion()
    const { reducedMotion } = useContext(MotionConfigContext)

    if (reducedMotion === "never") {
        return false
    } else if (reducedMotion === "always") {
        return true
    } else {
        return reducedMotionPreference
    }
}
