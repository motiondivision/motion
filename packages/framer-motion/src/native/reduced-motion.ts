import { hasReducedMotionListener, prefersReducedMotion } from "motion-dom"
import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * React Native has no prefers-reduced-motion media query, so Motion's
 * reduced motion setting follows the OS setting via AccessibilityInfo.
 */
export function initNativeReducedMotion() {
    if (hasReducedMotionListener.current) return
    hasReducedMotionListener.current = true

    const set = (isEnabled: boolean) => (prefersReducedMotion.current = isEnabled)
    AccessibilityInfo.isReduceMotionEnabled().then(set)
    AccessibilityInfo.addEventListener("reduceMotionChanged", set)
}

/**
 * Whether the device's "Reduce Motion" setting is on. It's `null` until
 * the setting has been read, and updates when the setting changes.
 */
export function useReducedMotion() {
    const [shouldReduceMotion, setShouldReduceMotion] = useState(
        prefersReducedMotion.current
    )

    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then(setShouldReduceMotion)
        const subscription = AccessibilityInfo.addEventListener(
            "reduceMotionChanged",
            setShouldReduceMotion
        )
        return () => subscription.remove()
    }, [])

    return shouldReduceMotion
}
