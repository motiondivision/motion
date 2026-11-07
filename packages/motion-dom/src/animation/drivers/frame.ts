import { frame, frameData, frameSteps } from "../../frameloop"
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
        if (driver.isNew) {
            /**
             * Drivers started during this tick run from the next frame,
             * as they would if each were scheduled on its own.
             */
            driver.isNew = false
        } else if (!driver.isHeld) {
            driver.update(timestamp)
        } else if (driver.needsUpdate) {
            driver.needsUpdate = false
            driver.idleTicks = 0
            driver.update(timestamp)
        } else if (++driver.idleTicks > 1) {
            /**
             * Held and up to date for a while, so it leaves until it's
             * started again. One seeked every frame, as by a scroll
             * timeline followed from JS, stays.
             */
            running.delete(driver)
        }
    }

    isTicking = false

    running.size || frameSteps.update.cancel(tick)
}

class FrameDriver implements DriverControls {
    isNew = false

    isHeld = false

    needsUpdate = false

    idleTicks = 0

    private once?: (frameData: FrameData) => void

    private isOnceScheduled = false

    constructor(public update: (timestamp: number) => void) {}

    /**
     * Without keepAlive, as when seeking, update once on the next frame.
     */
    start(keepAlive = true) {
        if (running.has(this)) {
            keepAlive ? (this.isHeld = false) : (this.needsUpdate = true)
        } else if (keepAlive) {
            this.cancelOnce()
            this.isHeld = false
            this.add()
        } else if (this.isHeld) {
            this.needsUpdate = true
            this.add()
        } else if (!this.isOnceScheduled) {
            this.isOnceScheduled = true
            frame.update(
                (this.once ||= ({ timestamp }) => {
                    this.isOnceScheduled = false
                    this.update(timestamp)
                })
            )
        }
    }

    /**
     * Stop updating every frame, after one more update. Holding and
     * playing again in the same frame, as playback controls do, doesn't
     * reschedule anything.
     */
    hold() {
        this.isHeld = this.needsUpdate = true
        running.has(this) || this.add()
    }

    stop() {
        this.cancelOnce()

        if (running.delete(this) && !running.size && !isTicking) {
            frameSteps.update.cancel(tick)
        }
    }

    /**
     * If we're processing this frame we can use the
     * framelocked timestamp to keep things in sync.
     */
    now() {
        return frameData.isProcessing ? frameData.timestamp : time.now()
    }

    private add() {
        this.idleTicks = 0
        running.size || frame.update(tick, true)
        this.isNew = isTicking
        running.add(this)
    }

    /**
     * The one-off update is only ever scheduled in the update step, so
     * it's only cancelled from there.
     */
    private cancelOnce() {
        if (this.isOnceScheduled) {
            this.isOnceScheduled = false
            frameSteps.update.cancel(this.once!)
        }
    }
}

export const frameloopDriver: Driver = (update) => new FrameDriver(update)
