import { MotionNodeState } from "motion-dom"
import { makeUseMotionNodeState } from "../../motion/utils/use-motion-value-state"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

export const useHTMLVisualState = /*@__PURE__*/ makeUseMotionNodeState({
    scrapeMotionValuesFromProps,
    StateConstructor: MotionNodeState, // TODO HTMLMotionNodeState
})
