"use client"

import type { VisualElement } from "motion-dom"
import { createContext } from "react"

export interface MotionContextProps<Instance = unknown> {
    visualElement?: VisualElement<Instance>
    initial?: false | string | string[]
    animate?: string | string[]
}

export const MotionContext = /* @__PURE__ */ createContext<MotionContextProps>(
    {}
)
