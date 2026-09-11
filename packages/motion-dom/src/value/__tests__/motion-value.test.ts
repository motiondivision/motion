import { MotionGlobalConfig } from "motion-utils"
import { motionValue } from "../"
import { frame, frameData } from "../../frameloop"
import { time } from "../../frameloop/sync-time"

describe("motionValue", () => {
    test("change event is type-inferred", () => {
        const value = motionValue(0)

        value.on("change", (latest) => latest / 2)
    })

    test("change event fires when value changes", () => {
        const value = motionValue(0)
        const callback = jest.fn()

        value.on("change", callback)

        expect(callback).not.toHaveBeenCalled()
        value.set(1)
        expect(callback).toHaveBeenCalledTimes(1)
        value.set(1)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("Velocity is calculated as zero when value is arbitrarily changed after creation", () => {
        const value = motionValue(0)
        frameData.isProcessing = false

        value.set(100)

        expect(value.getVelocity()).toEqual(0)
    })
})

describe("MotionValue change subscribers", () => {
    async function nextFrame() {
        return new Promise<void>((resolve) => {
            frame.postRender(() => resolve())
        })
    }

    test("a sole subscriber is notified without a SubscriptionManager", () => {
        const value = motionValue(0)
        const callback = jest.fn()

        value.on("change", callback)
        expect(value["events"].change).toBeUndefined()

        value.set(1)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback.mock.calls[0][0]).toBe(1)
    })

    test("a second subscriber creates a manager and preserves order", () => {
        const value = motionValue(0)
        const calls: string[] = []

        const cancelA = value.on("change", (v) => calls.push(`a:${v}`))
        const cancelB = value.on("change", (v) => calls.push(`b:${v}`))
        expect(value["events"].change.getSize()).toBe(2)

        value.set(1)
        expect(calls).toEqual(["a:1", "b:1"])

        cancelA()
        value.set(2)
        expect(calls).toEqual(["a:1", "b:1", "b:2"])

        const cancelC = value.on("change", (v) => calls.push(`c:${v}`))
        cancelB()
        value.set(3)
        expect(calls).toEqual(["a:1", "b:1", "b:2", "c:3"])

        cancelC()
        value.set(4)
        expect(calls).toHaveLength(4)
    })

    test("the slot is reused once its subscriber has unsubscribed", () => {
        const value = motionValue(0)
        const a = jest.fn()
        const b = jest.fn()

        value.on("change", a)()
        value.on("change", b)
        expect(value["events"].change).toBeUndefined()

        value.set(1)
        expect(a).not.toHaveBeenCalled()
        expect(b).toHaveBeenCalledTimes(1)
    })

    test("unsubscribing twice is harmless", () => {
        const value = motionValue(0)
        const a = jest.fn()
        const b = jest.fn()

        const cancelA = value.on("change", a)
        value.on("change", b)
        cancelA()
        cancelA()

        value.set(1)
        expect(a).not.toHaveBeenCalled()
        expect(b).toHaveBeenCalledTimes(1)
    })

    test("a subscriber added during the sole subscriber's notification doesn't re-notify it", () => {
        const value = motionValue(0)
        const calls: string[] = []
        const b = (v: number) => calls.push(`b:${v}`)

        value.on("change", (v) => {
            calls.push(`a:${v}`)
            if (v === 1) value.on("change", b)
        })

        value.set(1)
        expect(calls).toEqual(["a:1"])

        value.set(2)
        expect(calls).toEqual(["a:1", "a:2", "b:2"])
    })

    test("dirty notifies subscribers with the current value", () => {
        const value = motionValue(0)
        const callback = jest.fn()

        value.on("change", callback)
        value.dirty()

        expect(callback).toHaveBeenCalledWith(0)
    })

    test("stops the animation when the sole subscriber unsubscribes", async () => {
        const value = motionValue(0)
        const animation = { stop: jest.fn() }
        value.start(() => animation as any)

        const cancel = value.on("change", () => {})
        cancel()

        expect(animation.stop).not.toHaveBeenCalled()
        await nextFrame()
        expect(animation.stop).toHaveBeenCalledTimes(1)
    })

    test("doesn't stop the animation while another subscriber remains", async () => {
        const value = motionValue(0)
        const animation = { stop: jest.fn() }
        value.start(() => animation as any)

        value.on("change", () => {})
        value.on("change", () => {})()

        await nextFrame()
        expect(animation.stop).not.toHaveBeenCalled()
    })

    test("destroy detaches the sole subscriber", () => {
        const value = motionValue(0)
        const callback = jest.fn()

        value.on("change", callback)
        value.destroy()
        value.set(1)

        expect(callback).not.toHaveBeenCalled()
    })
})

describe("MotionValue velocity calculations", () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
    })
    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })

    test("Velocity is correct when value changes each animation frame", () => {
        const value = motionValue(0)

        frameData.isProcessing = true
        time.set(0)
        value.set(0)
        time.set(10)
        value.set(1)
        expect(value.getVelocity()).toEqual(100)
        frameData.isProcessing = false
    })

    test("Velocity is correct when value changes twice within one frame", () => {
        time.set(0)
        const value = motionValue(0)

        frameData.isProcessing = true

        value.set(0)
        time.set(10)
        value.set(1)
        expect(value.getVelocity()).toEqual(100)
        value.set(2)
        expect(value.getVelocity()).toEqual(200)

        frameData.isProcessing = false
    })

    test("Velocity is capped to the last estimated frame when value hasn't been updated in a long time, and is then updated", () => {
        const value = motionValue(0)
        frameData.isProcessing = true

        value.set(0)
        time.set(10)
        value.set(1)
        time.set(1000)
        value.set(2)

        expect(Math.round(value.getVelocity())).toEqual(33)

        frameData.isProcessing = false
    })

    test("Velocity is capped to the last estimated frame when value hasn't been updated in a long time, and is then updated outside frameloop", async () => {
        const value = motionValue(0)

        frameData.isProcessing = true

        value.set(0)
        time.set(10)
        value.set(1)
        frameData.isProcessing = false
        time.set(1000)
        value.set(2)

        expect(Math.round(value.getVelocity())).toEqual(33)
    })

    test("Velocity is capped to the last estimated frame when value hasn't been updated in a long time, and is then double updated outside frameloop", async () => {
        const value = motionValue(0)

        frameData.isProcessing = true

        value.set(0)
        time.set(10)
        value.set(1)
        frameData.isProcessing = false
        time.set(1000)
        value.set(2)
        value.set(3)

        expect(Math.round(value.getVelocity())).toEqual(67)
    })

    test("Velocity is zero when queried a long time after the previous set", async () => {
        const value = motionValue(0)

        frameData.isProcessing = true

        value.set(0)
        time.set(10)
        value.set(1)
        frameData.isProcessing = false

        time.set(1000)

        expect(Math.round(value.getVelocity())).toEqual(0)
    })

    test("Velocity is correctly calculated after being set with setWithVelocity", async () => {
        const value = motionValue(0)
        value.set(100)
        value.setWithVelocity(200, 100, 10)
        expect(Math.round(value.getVelocity())).toBe(-10000)
    })

    test("Velocity can be measured even if initialised with undefined", async () => {
        const value = motionValue<undefined | number>(undefined)
        expect((value as any).canTrackVelocity).toBe(null)
        value.set(1)
        expect((value as any).canTrackVelocity).toBe(true)

        const value2 = motionValue<undefined | string>(undefined)
        value2.set("test")
        expect((value2 as any).canTrackVelocity).toBe(false)
    })
})
