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

export const supportsScrollTimeline = /* @__PURE__ */ memoSupports(() => {
    if (window.ScrollTimeline === undefined) return false

    // Safari and Firefox expose ScrollTimeline but have bugs
    // with non-transform properties (e.g. opacity). Verify
    // the implementation works by running a small runtime test.
    try {
        const container = document.createElement("div")
        container.style.cssText =
            "position:fixed;top:-99999px;width:10px;height:10px;overflow:scroll"
        const child = document.createElement("div")
        child.style.height = "100px"
        container.appendChild(child)
        document.body.appendChild(container)

        // Force layout so scroll metrics are available
        container.offsetHeight

        const anim = container.animate(
            { opacity: [0, 1] },
            { duration: 1, fill: "both" }
        )
        anim.timeline = new ScrollTimeline({
            source: container,
        } as any) as any

        container.scrollTop = container.scrollHeight
        const opacity = parseFloat(getComputedStyle(container).opacity)

        anim.cancel()
        container.remove()

        return opacity > 0.9
    } catch (e) {
        return false
    }
}, "scrollTimeline")

export const supportsViewTimeline = /* @__PURE__ */ memoSupports(
    // ViewTimeline uses the same scroll-driven animation engine.
    // If ScrollTimeline can't correctly drive opacity, neither can ViewTimeline.
    () => window.ViewTimeline !== undefined && supportsScrollTimeline(),
    "viewTimeline"
)
