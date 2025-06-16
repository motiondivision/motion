import { NativeAnimation } from "../NativeAnimation"

const animationMaps = new WeakMap<
    Element,
    Map<string, NativeAnimation<string | number>>
>()
export const animationMapKey = (name: string, pseudoElement: string = "") =>
    `${name}:${pseudoElement}`

export function getAnimationMap(element: Element) {
    const map = animationMaps.get(element) || new Map()
    animationMaps.set(element, map)

    return map
}
