import type { DynamicOption } from "../types"
import type { VisualElement } from "../../render/VisualElement"

/**
 * Each child's index in document order. Sorting compares DOM positions, so
 * a parent's dispatch works it out once for all its children.
 */
export const getChildOrder = (children: Set<VisualElement>) =>
    Array.from(children).sort((a, b) => a.sortNodePosition(b))

export function calcChildStagger(
    children: Set<VisualElement>,
    child: VisualElement,
    delayChildren?: number | DynamicOption<number>,
    staggerChildren: number = 0,
    staggerDirection: number = 1,
    order?: VisualElement[]
): number {
    const isFunction = typeof delayChildren === "function"

    /**
     * Without a stagger, no delay depends on the child's place, so the
     * children aren't sorted.
     */
    if (!isFunction && !staggerChildren) return 0

    const index = (order || getChildOrder(children)).indexOf(child)
    const numChildren = children.size

    return isFunction
        ? delayChildren(index, numChildren)
        : staggerDirection === 1
        ? index * staggerChildren
        : (numChildren - 1 - index) * staggerChildren
}
