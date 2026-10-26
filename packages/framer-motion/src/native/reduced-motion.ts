import { hasReducedMotionListener, prefersReducedMotion } from "motion-dom"
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
