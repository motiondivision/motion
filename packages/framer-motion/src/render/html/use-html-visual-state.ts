"use client"

import { scrapeHTMLMotionValuesFromProps } from "motion-dom"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { createHtmlRenderState } from "./utils/create-render-state"

export const useHTMLVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeHTMLMotionValuesFromProps,
    createRenderState: createHtmlRenderState,
})
