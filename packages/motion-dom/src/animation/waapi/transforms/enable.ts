import { acceleration } from "./acceleration"
import {
    canAccelerateTransform,
    canGroupValue,
    joinGroup,
} from "./TransformAnimation"

const hooks = { canAccelerateTransform, canGroupValue, joinGroup }

/**
 * Let the animation engine compose and accelerate element transforms.
 */
export const enableAcceleration = () => {
    acceleration.current = hooks
}
