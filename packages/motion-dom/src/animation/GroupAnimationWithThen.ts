import { GroupAnimation } from "./GroupAnimation"
import { AnimationPlaybackControlsWithThen } from "./types"

export class GroupAnimationWithThen
    extends GroupAnimation
    implements AnimationPlaybackControlsWithThen
{
    then(onResolve: VoidFunction, _onReject?: VoidFunction) {
        return this.finished.finally(onResolve).then(() => {})
    }
}
