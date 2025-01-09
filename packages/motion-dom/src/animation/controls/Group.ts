import { AnimationPlaybackControls } from "../types"
import { BaseGroupPlaybackControls } from "./BaseGroup"

/**
 * TODO: This is a temporary class to support the legacy
 * thennable API
 */
export class GroupPlaybackControls
    extends BaseGroupPlaybackControls
    implements AnimationPlaybackControls
{
    animations: AnimationPlaybackControls[]

    then(onResolve: VoidFunction, onReject?: VoidFunction) {
        return Promise.all(this.animations).then(onResolve).catch(onReject)
    }
}
