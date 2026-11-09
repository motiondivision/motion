import type { AnimationType } from "../types"

export const variantPriorityOrder: AnimationType[] = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "whilePinch",
    "exit",
]

export const variantProps = /* @__PURE__ */ ["initial"].concat(
    variantPriorityOrder
)
