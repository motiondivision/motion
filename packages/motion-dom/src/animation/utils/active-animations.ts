import { NativeAnimation } from "../NativeAnimation"
import { AnyResolvedKeyframe } from "../types"

const animationMaps = new WeakMap<
    Element,
    Map<string, NativeAnimation<AnyResolvedKeyframe>>
>()
export const animationMapKey = (name: string, pseudoElement: string = "") =>
    `${name}:${pseudoElement}`

export function getAnimationMap(element: Element) {
    let map = animationMaps.get(element)
    if (!map) {
        map = new Map()
        animationMaps.set(element, map)
    }
    return map
}
