"use client"

import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { createSvgRenderState } from "./utils/create-render-state"
import { scrapeMotionValuesFromProps as scrapeSVGProps } from "./utils/scrape-motion-values"

export const useSVGVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeSVGProps,
    createRenderState: createSvgRenderState,
})
