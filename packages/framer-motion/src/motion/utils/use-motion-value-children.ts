import { MotionProps } from "../types"
import { VisualElement } from "../../render/VisualElement"
import { useEffect } from "react"
import { isMotionValue } from "motion-dom"

/**
 * Hook to handle motion value children updates
 * @param props - Motion component props containing children
 * @param visualElement - Visual element instance to update
 */
export function useMotionValueChildren(
    children: MotionProps['children'],
    visualElement: VisualElement<any>
) {
    useEffect(() => {
        // Skip if children is not a motion value
        if (!children || !isMotionValue(children)) return

        // Subscribe to motion value changes and update text content
        const subscription = children.on("change", (latest) => {
            if (visualElement.current) {
                visualElement.current.textContent = `${latest}`
            }
        })
        return subscription
    }, [children, visualElement])
}
