import { addToScope, AnimationPlaybackControls, bindToScope } from "motion-dom"
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

    if (typeof onScroll === "function") {
        const callback = bindToScope(onScroll)
        return addToScope(
            scrollInfo(
                (info) => callback(info[axis].progress, info),
                optionsWithDefaults
            )
        )
    }

    return addToScope(attachToAnimation(onScroll, optionsWithDefaults))
}
