import { frameData } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { motionValue } from "../../value"
import { Driver } from "../drivers/types"
import { JSAnimation } from "../JSAnimation"

/**
 * A driver whose frames are stepped by hand, so the test can stop the
 * animation between frames, as an event handler would.
 */
function manualDriver() {
    let update: ((timestamp: number) => void) | undefined
    const driver: Driver = (callback) => ({
        start: () => (update = callback),
        stop: () => (update = undefined),
        now: () => time.now(),
    })

    const step = (timestamp: number) => {
        frameData.isProcessing = true
        time.set(timestamp)
        update?.(timestamp)
        frameData.isProcessing = false
    }

    return { driver, step }
}

describe("Stopping a JSAnimation between frames", () => {
    afterEach(() => {
        frameData.isProcessing = false
    })

    /**
     * Stopping catches the value up to the current time, with the
     * animation's time rounded to whole milliseconds. Stopped within a
     * millisecond of a frame, the value doesn't move, which must not
     * read as the value coming to rest.
     */
    test.each([0.2, 0.6, 3])(
        "keeps the value's velocity %fms after a frame",
        (offset) => {
            const { driver, step } = manualDriver()
            const value = motionValue(0)

            step(0)
            const animation = new JSAnimation({
                keyframes: [0, 1000],
                duration: 1000,
                ease: (p: number) => p,
                driver,
                motionValue: value,
                onUpdate: (v) => value.set(v),
            })

            for (let t = 0; t <= 160; t += 16) step(t)
            expect(Math.round(value.getVelocity())).toBe(1000)

            time.set(160 + offset)
            animation.stop()

            expect(Math.abs(value.getVelocity() - 1000)).toBeLessThan(50)
        }
    )
})
