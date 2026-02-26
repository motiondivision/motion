import { supportsScrollTimeline } from "motion-dom"

export function canUseNativeTimeline(target?: Element) {
    return (
        typeof window !== "undefined" && !target && supportsScrollTimeline()
    )
}
