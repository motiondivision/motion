"use client"

import { warnOnce } from "motion-utils"
import { useState } from "react"
import { initPrefersReducedMotion } from "."
import { hasReducedMotionListener, prefersReducedMotion } from "./state"

/**
 * A hook that returns `true` if we should be using reduced motion based on the current device's Reduced Motion setting.
 *
 * This can be used to implement changes to your UI based on Reduced Motion. For instance, replacing motion-sickness inducing
 * `x`/`y` animations with `opacity`, disabling the autoplay of background videos, or turning off parallax motion.
 *
 * It will actively respond to changes and re-render your components with the latest setting.
 *
 * ```jsx
 * export function Sidebar({ isOpen }) {
 *   const shouldReduceMotion = useReducedMotion()
 *   const closedX = shouldReduceMotion ? 0 : "-100%"
 *
 *   return (
 *     <motion.div animate={{
 *       opacity: isOpen ? 1 : 0,
 *       x: isOpen ? 0 : closedX
 *     }} />
 *   )
 * }
 * ```
 *
 * @return boolean
 *
 * @public
 */
export function useReducedMotion() {
    /**
     * Lazy initialisation of prefersReducedMotion
     */
    !hasReducedMotionListener.current && initPrefersReducedMotion()

    const [shouldReduceMotion] = useState(prefersReducedMotion.current)

    if (process.env.NODE_ENV !== "production") {
        warnOnce(
            shouldReduceMotion !== true,
            "You have Reduced Motion enabled on your device. Animations may not appear as expected.",
            "reduced-motion-disabled"
        )
    }

    /**
     * TODO See if people miss automatically updating shouldReduceMotion setting
     */

    return shouldReduceMotion
}
