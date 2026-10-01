"use client"

import { scrapeSVGMotionValuesFromProps, type SVGRenderState } from "motion-dom"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"

export const useSVGVisualState = /*@__PURE__*/ makeUseVisualState<SVGElement, SVGRenderState>({
    scrapeMotionValuesFromProps: scrapeSVGMotionValuesFromProps,
})
