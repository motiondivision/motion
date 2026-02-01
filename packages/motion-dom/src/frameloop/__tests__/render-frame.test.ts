import { MotionGlobalConfig } from "motion-utils"
import { frame, cancelFrame, frameData } from ".."
import {
    renderFrame,
    setManualTiming,
    isManualTiming,
} from "../render-frame"

describe("renderFrame", () => {
    afterEach(() => {
        // Reset manual timing after each test
        setManualTiming(false)
    })

    it("processes scheduled callbacks with provided timestamp", () => {
        const values: number[] = []

        frame.update(({ timestamp }) => {
            values.push(timestamp)
        })

        renderFrame({ timestamp: 1000 })

        expect(values).toEqual([1000])
    })

    it("processes callbacks in correct order", () => {
        const order: string[] = []

        frame.setup(() => order.push("setup"))
        frame.read(() => order.push("read"))
        frame.resolveKeyframes(() => order.push("resolveKeyframes"))
        frame.preUpdate(() => order.push("preUpdate"))
        frame.update(() => order.push("update"))
        frame.preRender(() => order.push("preRender"))
        frame.render(() => order.push("render"))
        frame.postRender(() => order.push("postRender"))

        renderFrame({ timestamp: 0 })

        expect(order).toEqual([
            "setup",
            "read",
            "resolveKeyframes",
            "preUpdate",
            "update",
            "preRender",
            "render",
            "postRender",
        ])
    })

    it("converts frame number to timestamp using fps", () => {
        const values: number[] = []

        frame.update(({ timestamp }) => {
            values.push(timestamp)
        })

        // Frame 30 at 30fps = 1000ms
        renderFrame({ frame: 30, fps: 30 })

        expect(values).toEqual([1000])
    })

    it("uses default fps of 30 when not specified", () => {
        const values: number[] = []

        frame.update(({ timestamp }) => {
            values.push(timestamp)
        })

        // Frame 15 at default 30fps = 500ms
        renderFrame({ frame: 15 })

        expect(values).toEqual([500])
    })

    it("calculates delta based on fps when using frame number", () => {
        const values: number[] = []

        frame.update(({ delta }) => {
            values.push(delta)
        })

        // At 30fps, delta should be ~33.33ms
        renderFrame({ frame: 1, fps: 30 })

        expect(values[0]).toBeCloseTo(1000 / 30)
    })

    it("uses provided delta value", () => {
        const values: number[] = []

        frame.update(({ delta }) => {
            values.push(delta)
        })

        renderFrame({ timestamp: 1000, delta: 16 })

        expect(values).toEqual([16])
    })

    it("temporarily enables manual timing during frame processing", () => {
        let timingDuringRender: boolean | undefined

        frame.update(() => {
            timingDuringRender = MotionGlobalConfig.useManualTiming
        })

        // Ensure manual timing is off before
        expect(MotionGlobalConfig.useManualTiming).toBeFalsy()

        renderFrame({ timestamp: 0 })

        // Manual timing was enabled during render
        expect(timingDuringRender).toBe(true)

        // Manual timing is restored after render
        expect(MotionGlobalConfig.useManualTiming).toBeFalsy()
    })

    it("preserves previous manual timing setting after render", () => {
        setManualTiming(true)

        frame.update(() => {})
        renderFrame({ timestamp: 0 })

        // Should still be true
        expect(MotionGlobalConfig.useManualTiming).toBe(true)
    })

    it("supports incremental frame rendering", () => {
        const timestamps: number[] = []

        // Schedule a keepAlive callback
        frame.update(({ timestamp }) => {
            timestamps.push(timestamp)
        }, true)

        renderFrame({ frame: 0, fps: 30 })
        renderFrame({ frame: 1, fps: 30 })
        renderFrame({ frame: 2, fps: 30 })

        // Cleanup keepAlive
        const cleanup = frame.update(() => {}, true)
        cancelFrame(cleanup)

        expect(timestamps).toEqual([0, 1000 / 30, (2 * 1000) / 30])
    })
})

describe("setManualTiming", () => {
    afterEach(() => {
        setManualTiming(false)
    })

    it("enables manual timing mode", () => {
        expect(MotionGlobalConfig.useManualTiming).toBeFalsy()

        setManualTiming(true)

        expect(MotionGlobalConfig.useManualTiming).toBe(true)
    })

    it("disables manual timing mode", () => {
        setManualTiming(true)
        expect(MotionGlobalConfig.useManualTiming).toBe(true)

        setManualTiming(false)
        expect(MotionGlobalConfig.useManualTiming).toBe(false)
    })
})

describe("isManualTiming", () => {
    afterEach(() => {
        setManualTiming(false)
    })

    it("returns false when manual timing is disabled", () => {
        expect(isManualTiming()).toBe(false)
    })

    it("returns true when manual timing is enabled", () => {
        setManualTiming(true)
        expect(isManualTiming()).toBe(true)
    })
})
