import { AnimationPlaybackControls } from "motion-dom"
import { noop } from "motion-utils"
import { attachToAnimation } from "./attach-animation"
import { scrollInfo } from "./track"
import { OnScroll, ScrollOptions } from "./types"

export function scroll(
    onScroll: OnScroll | AnimationPlaybackControls,
    {
        axis = "y",
        source,
        container = document.scrollingElement as Element,
        ...options
    }: ScrollOptions = {}
): VoidFunction {
    if (!container) return noop as VoidFunction

    const optionsWithDefaults = {
        axis,
        container: source || container,
        ...options,
    }

    return typeof onScroll === "function"
        ? scrollInfo(
              (info) => onScroll(info[axis].progress, info),
              optionsWithDefaults
          )
        : attachToAnimation(onScroll, optionsWithDefaults)
}
