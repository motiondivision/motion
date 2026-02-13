import { ProgressTimeline } from "../.."
import { memoSupports } from "./memo"

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

export const supportsScrollTimeline = /* @__PURE__ */ memoSupports(
    () => window.ScrollTimeline !== undefined,
    "scrollTimeline"
)
