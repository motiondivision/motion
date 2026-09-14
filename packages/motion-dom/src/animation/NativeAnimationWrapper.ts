import { NativeAnimation } from "./NativeAnimation"
import { AnyResolvedKeyframe } from "./types"
import { notifyAnimationStart } from "./utils/notify-inspector"

export class NativeAnimationWrapper<
    T extends AnyResolvedKeyframe
> extends NativeAnimation<T> {
    constructor(animation: Animation) {
        super()

        this.animation = animation
        animation.onfinish = () => {
            this.finishedTime = this.time
            this.notifyFinished()
        }

        /**
         * The optionless super() returns before NativeAnimation's own
         * notify, so wrapped animations (view transition cross-fades)
         * report here, after the wrapped WAAPI animation is attached.
         */
        notifyAnimationStart(this, {})
    }
}
