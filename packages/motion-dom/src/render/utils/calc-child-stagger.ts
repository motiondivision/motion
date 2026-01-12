import type { DynamicOption } from "../../animation/types"

/**
 * Calculate the stagger delay for a child element.
 * Uses `any` types for visual elements to avoid circular dependencies.
 */
export function calcChildStagger(
    children: Set<any>,
    child: any,
    delayChildren?: number | DynamicOption<number>,
    staggerChildren: number = 0,
    staggerDirection: number = 1
): number {
    const index = Array.from(children)
        .sort((a, b) => a.sortNodePosition(b))
        .indexOf(child)
    const numChildren = children.size
    const maxStaggerDuration = (numChildren - 1) * staggerChildren
    const delayIsFunction = typeof delayChildren === "function"

    return delayIsFunction
        ? delayChildren(index, numChildren)
        : staggerDirection === 1
        ? index * staggerChildren
        : maxStaggerDuration - index * staggerChildren
}
