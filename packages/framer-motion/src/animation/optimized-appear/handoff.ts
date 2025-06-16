import type { Batcher } from "motion-dom"
import { appearAnimationStore } from "./store"
import { appearStoreId } from "./store-id"

export function handoffOptimizedAppearAnimation(
    elementId: string,
    valueName: string,
    frame: Batcher
): number | null {
    const storeId = appearStoreId(elementId, valueName)
    const optimisedAnimation = appearAnimationStore.get(storeId)

    if (!optimisedAnimation) {
        return null
    }

    const { animation, startTime } = optimisedAnimation

    function cancelAnimation() {
        window.MotionCancelOptimisedAnimation?.(elementId, valueName, frame)
    }

    /**
     * We can cancel the animation once it's finished now that we've synced
     * with Motion.
     *
     * Prefer onfinish over finished as onfinish is backwards compatible with
     * older browsers.
     */
    animation.onfinish = cancelAnimation

    if (startTime === null || window.MotionHandoffIsComplete?.(elementId)) {
        /**
         * If the startTime is null, this animation is the Paint Ready detection animation
         * and we can cancel it immediately without handoff.
         *
         * Or if we've already handed off the animation then we're now interrupting it.
         * In which case we need to cancel it.
         */
        cancelAnimation()
        return null
    } else {
        return startTime
    }
}
