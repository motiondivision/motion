import { MotionNodeState } from "motion-dom"
import { makeUseMotionNodeState } from "../../motion/utils/use-motion-value-state"
import { scrapeMotionValuesFromProps as scrapeSVGProps } from "./utils/scrape-motion-values"

export const useSVGVisualState = /*@__PURE__*/ makeUseMotionNodeState({
    scrapeMotionValuesFromProps: scrapeSVGProps,
    StateConstructor: MotionNodeState, // TODO SVGMotionNodeState
})
