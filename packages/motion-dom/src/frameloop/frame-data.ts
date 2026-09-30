import { FrameData } from "./types"

/**
 * The frameloop's state, kept apart from the frameloop itself so that
 * reading it doesn't bundle the scheduler.
 */
export const frameData: FrameData = {
    delta: 0.0,
    timestamp: 0.0,
    isProcessing: false,
}
