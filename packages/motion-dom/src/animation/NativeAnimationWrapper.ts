import { NativeAnimation } from "./NativeAnimation"

export class NativeAnimationWrapper<
    T extends string | number
> extends NativeAnimation<T> {
    constructor(animation: Animation) {
        super()

        this.animation = animation
        animation.onfinish = () => {
            this.finishedTime = this.time
            this.notifyFinished()
        }
    }
}
