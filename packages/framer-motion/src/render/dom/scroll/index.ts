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

    let prevProgress: number | undefined

    /**
     * Callbacks that only declare progress are notified when it changes.
     * Callbacks that declare info are notified every frame, as velocity and
     * measurements can change independently of progress.
     */
    return typeof onScroll === "function"
        ? scrollInfo((info) => {
              const progress = info[axis].progress

              if (onScroll.length > 1 || progress !== prevProgress) {
                  onScroll(progress, info)
                  prevProgress = progress
              }
          }, optionsWithDefaults)
        : attachToAnimation(onScroll, optionsWithDefaults)
}
