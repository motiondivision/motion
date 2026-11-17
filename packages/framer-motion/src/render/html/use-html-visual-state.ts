"use client"

import { scrapeHTMLMotionValuesFromProps } from "motion-dom"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"

export const useHTMLVisualState = /*@__PURE__*/ makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeHTMLMotionValuesFromProps,
})
