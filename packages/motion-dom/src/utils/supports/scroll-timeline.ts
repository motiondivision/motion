import { ProgressTimeline } from "../.."
import { memoSupports } from "./memo"

declare global {
    interface Window {
        ScrollTimeline: ScrollTimeline
        ViewTimeline: ViewTimeline
    }
}

declare class ScrollTimeline implements ProgressTimeline {
    constructor(options: ScrollOptions)

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

declare class ViewTimeline implements ProgressTimeline {
    constructor(options: { subject: Element; axis?: string })

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

export const supportsScrollTimeline = /* @__PURE__ */ memoSupports(
    () => window.ScrollTimeline !== undefined,
    "scrollTimeline"
)

export const supportsViewTimeline = /* @__PURE__ */ memoSupports(
    () => window.ViewTimeline !== undefined,
    "viewTimeline"
)
