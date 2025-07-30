import { DynamicOption } from "motion-dom"
import { VisualElement } from "../../render/VisualElement"

export function calcChildStagger(
    children: Set<VisualElement>,
    child: VisualElement,
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
