"use client"

import { MotionValue } from "motion-dom"
import { useConstant } from "../../utils/use-constant"
import { useMotionValueEvent } from "../../utils/use-motion-value-event"
import type { VisualElement } from "../VisualElement"

export function useMotionValueChild(
    children: MotionValue<number | string>,
    visualElement?: VisualElement<HTMLElement | SVGElement>
) {
    const render = useConstant(() => children.get())

    useMotionValueEvent(children, "change", (latest) => {
        if (visualElement && visualElement.current) {
            visualElement.current.textContent = `${latest}`
        }
    })

    return render
}
