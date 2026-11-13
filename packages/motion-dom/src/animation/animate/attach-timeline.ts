import { supportsScrollTimeline } from "../../utils/supports/scroll-timeline"
import { flushKeyframeResolvers } from "../keyframes/KeyframesResolver"
import {
    MultiValueAnimation,
    timelineSupport,
    watch,
} from "../MultiValueAnimation"
import { initTrack } from "../track"
import { TimelineWithFallback } from "../types"

/**
 * Make a shared animation follow a timeline.
 */
function attachTimeline(
    animation: MultiValueAnimation,
    timeline: TimelineWithFallback
): VoidFunction {
    animation.numPending && flushKeyframeResolvers()

    /**
     * WAAPI values follow a native scroll timeline. Without one, they
     * follow it from JS, like the rest.
     */
    const isNative = timeline.timeline && supportsScrollTimeline()

    /**
     * WAAPI values follow a native scroll timeline. Without one, they,
     * and the rest, follow it on the shared clock. An easing that was
     * only a default is made linear, as a JSAnimation's is.
     */
    for (const track of animation.tracks) {
        const { native, options } = track
        if (track.isStopped) continue
        if (track.plan.base.allowFlatten) {
            native
                ? native.effect?.updateTiming({ easing: "linear" })
                : ((options.type = "keyframes" as any),
                  (options.ease = "linear"),
                  /**
                   * Not that of a spring made into an easing.
                   */
                  (options.duration = track.plan.base.duration),
                  track.isReady && initTrack(track))
        }
        if (native && isNative) {
            watch(native)
            native.timeline = timeline.timeline as any
            track.isScrolling = true
            timeline.onAttach?.(native)
        }

        /**
         * Transforms follow a native timeline on the compositor too.
         */
        if (track.isTransform) {
            isNative && track.canAccelerate
                ? (track.scrollTimeline = timeline)
                : track.observe()
            track.group?.schedule(true)
        }
    }
    /**
     * Only values off the native timeline follow it from JS.
     */
    for (const track of animation.tracks) {
        track.isStopped ||
            track.isScrolling ||
            track.scrollTimeline ||
            animation.follow(timeline)
    }
    return () => animation.unfollow?.()
}

/**
 * Let shared animations follow a timeline. Called by the code that attaches
 * one, as it does, so the animations of bundles without it don't carry
 * the code.
 */
export const supportTimelines = () => {
    timelineSupport.attach = attachTimeline
}
