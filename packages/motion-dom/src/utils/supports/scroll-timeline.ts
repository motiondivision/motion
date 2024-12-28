import { memo } from "motion-utils"
import { ProgressTimeline } from "../.."

declare global {
    interface Window {
        ScrollTimeline: ScrollTimeline
    }
}

declare class ScrollTimeline implements ProgressTimeline {
    constructor(options: ScrollOptions)

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

export const supportsScrollTimeline = memo(
    () => window.ScrollTimeline !== undefined
)
