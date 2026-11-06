import { fillOffset } from "./fill"

export function defaultOffset(arr: any[]): number[] {
    /**
     * Most animations have two keyframes.
     */
    if (arr.length === 2) return [0, 1]

    const offset = [0]
    fillOffset(offset, arr.length - 1)
    return offset
}
