import { cubicBezier } from "./cubic-bezier"
import { mirrorEasing } from "./modifiers/mirror"
import { reverseEasing } from "./modifiers/reverse"

export const backOut = /*@__PURE__*/ cubicBezier(0.33, 1.53, 0.69, 0.99)
export const backIn = /*@__PURE__*/ reverseEasing(backOut)
export const backInOut = /*@__PURE__*/ mirrorEasing(backIn)
