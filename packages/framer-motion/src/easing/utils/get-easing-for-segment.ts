import { Easing } from "../../../../motion-utils/src/easing/types"
import { wrap } from "../../utils/wrap"
import { isEasingArray } from "./is-easing-array"

export function getEasingForSegment(
    easing: Easing | Easing[],
    i: number
): Easing {
    return isEasingArray(easing) ? easing[wrap(0, easing.length, i)] : easing
}
