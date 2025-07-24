"use client"

import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { createHtmlRenderState } from "./utils/create-render-state"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

export const useHTMLVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps,
    createRenderState: createHtmlRenderState,
})
