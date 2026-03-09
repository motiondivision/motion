"use client"

import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureBundle } from "./feature-bundle"

export const motion = /*@__PURE__*/ createMotionProxy(
    featureBundle,
    createDomVisualElement
)
