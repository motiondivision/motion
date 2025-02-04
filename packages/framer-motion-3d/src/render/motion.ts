"use client"

import {
    animations,
    createRendererMotionComponent,
    FeatureBundle,
    makeUseVisualState,
} from "framer-motion"
import type { ThreeMotionComponents, ThreeRenderState } from "../types"
import { createRenderState, createVisualElement } from "./create-visual-element"
import { useRender } from "./use-render"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-value"

const useVisualState = makeUseVisualState({
    scrapeMotionValuesFromProps,
    createRenderState,
})

const preloadedFeatures: Partial<FeatureBundle> = {
    ...animations,
}

function custom<Props extends {}>(Component: string) {
    return createRendererMotionComponent<Props, any, ThreeRenderState>({
        Component,
        preloadedFeatures,
        useRender,
        useVisualState,
        createVisualElement,
    } as any)
}

const componentCache = new Map<string, any>()

/**
 * @deprecated Motion 3D is deprecated.
 */
export const motion = new Proxy(custom, {
    get: (_, key: string) => {
        !componentCache.has(key) && componentCache.set(key, custom(key))
        return componentCache.get(key)!
    },
}) as typeof custom & ThreeMotionComponents
