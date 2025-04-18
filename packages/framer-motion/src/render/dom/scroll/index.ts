import { AnimationPlaybackControls } from "motion-dom"
import { attachToAnimation } from "./attach-animation"
import { attachToFunction } from "./attach-function"
import { OnScroll, ScrollOptions } from "./types"

export function scroll(
    onScroll: OnScroll | AnimationPlaybackControls,
    {
        axis = "y",
        container = document.documentElement,
        ...options
    }: ScrollOptions = {}
): VoidFunction {
    const optionsWithDefaults = { axis, container, ...options }

    return typeof onScroll === "function"
        ? attachToFunction(onScroll, optionsWithDefaults)
        : attachToAnimation(onScroll, optionsWithDefaults)
}
