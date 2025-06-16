import { Easing } from "../types"

export const isEasingArray = (ease: any): ease is Easing[] => {
    return Array.isArray(ease) && typeof ease[0] !== "number"
}
