import { cancelFrame, frame, frameData } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { FrameData } from "../../frameloop/types"
import { Driver, DriverControls } from "./types"

/**
 * Running frame loop drivers, ticked by one frame.update callback rather
 * than one each, so a frame with many JS animations doesn't queue and
 * check each of them.
 */
const running = new Set<FrameDriver>()

let isTicking = false

const tick = ({ timestamp }: FrameData) => {
    isTicking = true

    for (const driver of running) {
        /**
         * Drivers started during this tick run from the next frame, as
         * they would if each were scheduled on its own.
         */
        driver.isNew ? (driver.isNew = false) : driver.update(timestamp)
    }

    isTicking = false

    running.size || cancelFrame(tick)
}

class FrameDriver implements DriverControls {
    isNew = false

    private once?: (frameData: FrameData) => void

    constructor(public update: (timestamp: number) => void) {}

    /**
     * Without keepAlive, as when seeking, update once on the next frame.
     */
    start(keepAlive = true) {
        if (running.has(this)) return

        if (keepAlive) {
            this.once && cancelFrame(this.once)
            running.size || frame.update(tick, true)
            this.isNew = isTicking
            running.add(this)
        } else {
            frame.update(
                (this.once ||= ({ timestamp }) => this.update(timestamp))
            )
        }
    }

    stop() {
        this.once && cancelFrame(this.once)

        if (running.delete(this) && !running.size && !isTicking) {
            cancelFrame(tick)
        }
    }

    /**
     * If we're processing this frame we can use the
     * framelocked timestamp to keep things in sync.
     */
    now() {
        return frameData.isProcessing ? frameData.timestamp : time.now()
    }
}

export const frameloopDriver: Driver = (update) => new FrameDriver(update)
