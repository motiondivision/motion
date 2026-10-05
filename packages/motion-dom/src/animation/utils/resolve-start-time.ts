import { MotionGlobalConfig } from "motion-utils"

/**
 * If an animation's keyframes resolve, or its first frame renders, more than
 * this long after its start time, it starts from then instead. While we prefer
 * to "start" an animation as soon as it's triggered, this avoids a visual jump
 * into it after main thread work.
 *
 * Manual timing steps frames by however long it likes, so never lags.
 */
const MAX_START_DELAY = 40

export const resolveStartTime = (startTime: number, now: number) =>
    now - startTime > MAX_START_DELAY && !MotionGlobalConfig.useManualTiming
        ? now
        : startTime
