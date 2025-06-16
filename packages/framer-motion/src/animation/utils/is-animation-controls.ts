import { LegacyAnimationControls } from "motion-dom"

export function isAnimationControls(v?: unknown): v is LegacyAnimationControls {
    return (
        v !== null &&
        typeof v === "object" &&
        typeof (v as LegacyAnimationControls).start === "function"
    )
}
