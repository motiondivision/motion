// Accepts an easing function and returns a new one that outputs reversed values.

import { EasingModifier } from "../types"

// Turns easeIn into easeOut.
export const reverseEasing: EasingModifier = (easing) => (p) =>
    1 - easing(1 - p)
