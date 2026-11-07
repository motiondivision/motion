import { frame, frameData, frameSteps } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { FrameData } from "../../frameloop/types"
import { Driver, DriverControls, DriverLane } from "./types"

/**
 * Running frame loop drivers, ticked by one frame.update callback rather
 * than one each, so a frame with many JS animations doesn't queue and
 * check each of them.
 */
const running: FrameDriver[] = []

/**
 * Running drivers. A stopped driver stays in `running`, marked as not
 * running, until the next tick leaves it out.
 */
let numRunning = 0

let isTicking = false

const remove = (driver: FrameDriver) => {
    if (!driver.isRunning) return false
    driver.isRunning = false
    numRunning--
    return true
}

const tick = ({ timestamp }: FrameData) => {
    isTicking = true

    let kept = 0
    for (let i = 0; i < running.length; i++) {
        const driver = running[i]
        if (!driver.isRunning) {
            driver.isListed = false
            continue
        }
        running[kept++] = driver

        if (driver.isNew) {
            /**
             * Drivers started during this tick run from the next frame,
             * as they would if each were scheduled on its own.
             */
            driver.isNew = false
        } else if (!driver.isHeld) {
            /**
             * A driver's lane is run here, as one loop over every
             * running blend, rather than through each animation's update.
             */
            const { lane } = driver
            if (lane) {
                const t = Math.round(timestamp - lane.startTime)
                if (t > lane.from && t < lane.to) {
                    lane.write(
                        lane.origin +
                            lane.delta *
                                lane.ease(
                                    (t - lane.from) / (lane.to - lane.from)
                                ),
                        t - lane.delay
                    )
                    continue
                }
                driver.lane = undefined
            }
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
            remove(driver)
        }
    }

    /**
     * Drivers stopped after they were kept are left out next tick.
     */
    running.length = kept

    isTicking = false

    numRunning || frameSteps.update.cancel(tick)
}

class FrameDriver implements DriverControls {
    isNew = false

    isHeld = false

    needsUpdate = false

    idleTicks = 0

    lane?: DriverLane

    isRunning = false

    /**
     * In `running`, which a stopped driver stays in until the next tick.
     */
    isListed = false

    private once?: (frameData: FrameData) => void

    private isOnceScheduled = false

    constructor(public update: (timestamp: number) => void) {}

    /**
     * Without keepAlive, as when seeking, update once on the next frame.
     */
    start(keepAlive = true) {
        this.lane = undefined
        if (this.isRunning) {
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
        this.lane = undefined
        this.isHeld = this.needsUpdate = true
        this.isRunning || this.add()
    }

    stop() {
        this.lane = undefined
        this.cancelOnce()

        if (remove(this) && !numRunning && !isTicking) {
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
        numRunning++ || frame.update(tick, true)
        this.isNew = isTicking
        this.isRunning = true
        if (!this.isListed) {
            this.isListed = true
            running.push(this)
        }
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
