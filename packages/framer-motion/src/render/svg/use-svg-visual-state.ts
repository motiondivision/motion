"use client"

import { scrapeSVGMotionValuesFromProps } from "motion-dom"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { createSvgRenderState } from "./utils/create-render-state"

export const useSVGVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeSVGMotionValuesFromProps,
    createRenderState: createSvgRenderState,
})
