"use client"

import { scrapeHTMLMotionValuesFromProps, type HTMLRenderState } from "motion-dom"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"

export const useHTMLVisualState = /*@__PURE__*/ makeUseVisualState<HTMLElement, HTMLRenderState>({
    scrapeMotionValuesFromProps: scrapeHTMLMotionValuesFromProps,
})
