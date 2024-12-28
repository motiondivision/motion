import { Transition, ValueKeyframesDefinition } from "../types"
import { NativeAnimationControls } from "./NativeAnimationControls"
import { convertMotionOptionsToNative } from "./utils/convert-options"

export class PseudoAnimation extends NativeAnimationControls {
    constructor(
        target: Element,
        pseudoElement: string,
        valueName: string,
        keyframes: ValueKeyframesDefinition,
        options: Transition
    ) {
        const animationOptions = convertMotionOptionsToNative(
            valueName,
            keyframes,
            options
        )

        const animation = target.animate(animationOptions.keyframes, {
            pseudoElement,
            ...animationOptions.options,
        })

        super(animation)
    }
}
