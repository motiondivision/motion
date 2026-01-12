import { hasReducedMotionListener, prefersReducedMotion } from "./state"

const isBrowser = typeof window !== "undefined"

export function initPrefersReducedMotion() {
    hasReducedMotionListener.current = true
    if (!isBrowser) return

    if (window.matchMedia) {
        const motionMediaQuery = window.matchMedia("(prefers-reduced-motion)")

        const setReducedMotionPreferences = () =>
            (prefersReducedMotion.current = motionMediaQuery.matches)

        motionMediaQuery.addEventListener("change", setReducedMotionPreferences)

        setReducedMotionPreferences()
    } else {
        prefersReducedMotion.current = false
    }
}

export { prefersReducedMotion, hasReducedMotionListener }
