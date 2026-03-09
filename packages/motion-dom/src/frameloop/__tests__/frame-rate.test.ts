import { MotionGlobalConfig } from "motion-utils"
import { createRenderBatcher } from "../batcher"

describe("frameRate", () => {
    afterEach(() => {
        delete MotionGlobalConfig.frameRate
        MotionGlobalConfig.useManualTiming = false
    })

    it("throttles frame processing when frameRate is set", () => {
        MotionGlobalConfig.useManualTiming = true
        MotionGlobalConfig.frameRate = 30 // 33.33ms per frame

        let processBatchFn: Function | null = null
        const { schedule, state } = createRenderBatcher((cb) => {
            processBatchFn = cb
        }, true)

        let updateCount = 0
        schedule.update(() => updateCount++, true)

        // Simulate 6 rAF callbacks at ~60fps (16.67ms apart)
        const startTime = 1000
        for (let i = 0; i < 6; i++) {
            state.timestamp = startTime + i * 16.67
            processBatchFn!()
        }

        // At 30fps, over 6 frames at 16.67ms, only ~3 should process:
        // i=0: 1000ms    → process (first frame)
        // i=1: 1016.67ms → skip (16.67ms < 33.33ms)
        // i=2: 1033.34ms → process (33.34ms elapsed)
        // i=3: 1050.01ms → skip (16.67ms < 33.33ms)
        // i=4: 1066.68ms → process (33.34ms elapsed)
        // i=5: 1083.35ms → skip (16.67ms < 33.33ms)
        expect(updateCount).toBe(3)
    })

    it("does not throttle when frameRate is not set", () => {
        MotionGlobalConfig.useManualTiming = true

        let processBatchFn: Function | null = null
        const { schedule, state } = createRenderBatcher((cb) => {
            processBatchFn = cb
        }, true)

        let updateCount = 0
        schedule.update(() => updateCount++, true)

        const startTime = 1000
        for (let i = 0; i < 6; i++) {
            state.timestamp = startTime + i * 16.67
            processBatchFn!()
        }

        // Without frameRate set, all 6 frames should process
        expect(updateCount).toBe(6)
    })

    it("processes every frame when frameRate is >= 60", () => {
        MotionGlobalConfig.useManualTiming = true
        MotionGlobalConfig.frameRate = 60

        let processBatchFn: Function | null = null
        const { schedule, state } = createRenderBatcher((cb) => {
            processBatchFn = cb
        }, true)

        let updateCount = 0
        schedule.update(() => updateCount++, true)

        const startTime = 1000
        for (let i = 0; i < 6; i++) {
            state.timestamp = startTime + i * 16.67
            processBatchFn!()
        }

        // At 60fps (16.67ms interval), every 16.67ms frame should process
        expect(updateCount).toBe(6)
    })
})
