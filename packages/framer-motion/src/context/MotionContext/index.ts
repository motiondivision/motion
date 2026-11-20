"use client"

import type { VisualElement } from "motion-dom"
import { createContext } from "react"

export interface MotionContextProps<Instance = unknown> {
    visualElement?: VisualElement<Instance>
    initial?: false | string | string[]
    animate?: string | string[]
    /**
     * Makes this component's projection node, and those above it, when a
     * component below is about to make its own. Set by components that
     * fetch the layout feature, which can render before it arrives.
     *
     * @internal
     */
    project?: (ProjectionNode: any) => void
}

export const MotionContext = /* @__PURE__ */ createContext<MotionContextProps>(
    {}
)
