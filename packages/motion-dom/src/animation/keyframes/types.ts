import { Box } from "motion-utils"

/**
 * Temporary subset of VisualElement until VisualElement is
 * moved to motion-dom
 */
export interface WithRender {
    render: () => void
    readValue: (name: string, keyframe: any) => any
    getValue: (name: string, defaultValue?: any) => any
    current?: HTMLElement | SVGElement
    measureViewportBox: () => Box
}
