import { DynamicOption } from "motion-dom"
import { Easing, easingDefinitionToFunction } from "motion-utils"

export type StaggerOrigin = "first" | "last" | "center" | number

export type StaggerOptions = {
    startDelay?: number
    from?: StaggerOrigin
    ease?: Easing
}

export function getOriginIndex(from: StaggerOrigin, total: number) {
    if (from === "first") {
        return 0
    } else {
        const lastIndex = total - 1
        return from === "last" ? lastIndex : lastIndex / 2
    }
}

export function stagger(
    duration: number = 0.1,
    { startDelay = 0, from = 0, ease }: StaggerOptions = {}
): DynamicOption<number> {
    return (i: number, total: number) => {
        const fromIndex =
            typeof from === "number" ? from : getOriginIndex(from, total)
        const distance = Math.abs(fromIndex - i)
        let delay = duration * distance

        if (ease) {
            const maxDelay = total * duration
            const easingFunction = easingDefinitionToFunction(ease)
            delay = easingFunction(delay / maxDelay) * maxDelay
        }

        return startDelay + delay
    }
}
