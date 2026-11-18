import { clamp } from "motion-utils"
import { frameSteps } from "./frame"
import { frameData } from "./frame-data"
import { time } from "./sync-time"

/**
 * Run what's scheduled on the update, preRender and render steps now, so
 * the DOM is up to date without waiting for the next animation frame.
 */
export function flushFrame() {
    const now = time.now()
    frameData.delta = clamp(0, 1000 / 60, now - frameData.timestamp)
    frameData.timestamp = now
    frameData.isProcessing = true
    frameSteps.update.process(frameData)
    frameSteps.preRender.process(frameData)
    frameSteps.render.process(frameData)
    frameData.isProcessing = false
}
