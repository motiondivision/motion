import { AnimationPlaybackControls } from "motion-dom"
import { noop } from "motion-utils"
import { attachToAnimation } from "./attach-animation"
import { attachToFunction } from "./attach-function"
import { OnScroll, ScrollOptions } from "./types"

export function scroll(
    onScroll: OnScroll | AnimationPlaybackControls,
    {
        axis = "y",
        container = document.scrollingElement as Element,
        ...options
    }: ScrollOptions = {}
): VoidFunction {
    if (!container) return noop as VoidFunction

    const optionsWithDefaults = { axis, container, ...options }

    return typeof onScroll === "function"
        ? attachToFunction(onScroll, optionsWithDefaults)
        : attachToAnimation(onScroll, optionsWithDefaults)
}
