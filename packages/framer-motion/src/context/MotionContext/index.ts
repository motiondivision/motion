"use client"

import { createContext } from "react"
import type { VisualElement } from "../../render/VisualElement"

export interface MotionContextProps<Instance = unknown> {
    visualElement?: VisualElement<Instance>
    initial?: false | string | string[]
    animate?: string | string[]
}

export const MotionContext = /* @__PURE__ */ createContext<MotionContextProps>(
    {}
)
