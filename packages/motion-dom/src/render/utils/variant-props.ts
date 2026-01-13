import type { AnimationType } from "../types"

export const variantPriorityOrder: AnimationType[] = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit",
]

export const variantProps = ["initial", ...variantPriorityOrder]
