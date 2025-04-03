import { time } from "../frameloop/sync-time"
import { AnimationPlaybackControls } from "./types"

export class AsyncMotionValueAnimation implements AnimationPlaybackControls {
    constructor(options: AsyncAnimationOptions) {
        this.createdAt = time.now()
    }

    onKeyframeResolved() {
        this.resolvedAt = time.now()

        /**
         * If we can't animate this value with the resolved keyframes
         * then we should complete it immediately.
         */
        if (!isGenerator && !canAnimate(keyframes, name, type, velocity)) {
            // Finish immediately
            if (instantAnimationState.current || !delay) {
                onUpdate &&
                    onUpdate(
                        getFinalKeyframe(keyframes, this.options, finalKeyframe)
                    )
                onComplete && onComplete()
                this.resolveFinishedPromise()

                return
            }
            // Finish after a delay
            else {
                this.options.duration = 0
            }
        }

        /**
         * If the motion value has been unmounted, don't start
         * the animation. It might be that this is only pertinant when
         * deciding to start an AcceleratedAnimation?
         */
        if (!motionValue.owner || !motionValue.owner.current) {
            return false // TODO: Return a shell JSAnimation
        }

        // TODO: Pass this as an option to be respected by NativeAnimation
        // and JSAnimation
        // Override the browser calculated startTime with one synchronised to other JS
        // and WAAPI animations starting this event loop.
        animation.startTime = startTime ?? this.calcStartTime()

        if (this.pendingTimeline) {
            attachTimeline(animation, this.pendingTimeline)
            this.pendingTimeline = undefined
        } else {
            /**
             *
             */
        }
    }

    private _animation: AnimationPlaybackControls | undefined

    get animation(): AnimationPlaybackControls {
        if (!this._animation) {
            flushKeyframeResolvers()
        }

        return this._animation!
    }

    // TODO: Add async handlers
    //
    /**
     * This method uses the createdAt and resolvedAt to calculate the
     * animation startTime. *Ideally*, we would use the createdAt time as t=0
     * as the following frame would then be the first frame of the animation in
     * progress, which would feel snappier.
     *
     * However, if there's a delay (main thread work) between the creation of
     * the animation and the first commited frame, we prefer to use resolvedAt
     * to avoid a sudden jump into the animation.
     */
    //  calcStartTime() {
    //      if (!this.resolvedAt) return this.createdAt

    //      return this.resolvedAt - this.createdAt > MAX_RESOLVE_DELAY
    //          ? this.resolvedAt
    //          : this.createdAt
    //  }
}
