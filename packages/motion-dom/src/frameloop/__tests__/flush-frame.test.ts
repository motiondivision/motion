import { frame, frameData } from ".."
import { flushFrame } from "../flush-frame"
import { time } from "../sync-time"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

describe("flushFrame", () => {
    test("runs the update, preRender and render steps now, in order", async () => {
        const order: string[] = []
        frame.render(() => order.push("render"))
        frame.postRender(() => order.push("postRender"))
        frame.preRender(() => order.push("preRender"))
        frame.read(() => order.push("read"))
        frame.update(() => order.push("update"))

        flushFrame()
        expect(order).toEqual(["update", "preRender", "render"])

        await nextFrame()
        expect(order).toEqual([
            "update",
            "preRender",
            "render",
            "read",
            "postRender",
        ])
    })

    test("is processing a frame while its callbacks run, and not after", () => {
        let isProcessing = false
        frame.update(() => (isProcessing = frameData.isProcessing))

        flushFrame()
        expect(isProcessing).toBe(true)
        expect(frameData.isProcessing).toBe(false)
    })

    test("moves the frame's timestamp to now, with a delta of at most a 60fps frame", async () => {
        await nextFrame()
        frameData.timestamp = time.now() - 1000

        let seen: number[] = []
        frame.update(({ timestamp, delta }) => (seen = [timestamp, delta]))
        flushFrame()

        expect(seen).toEqual([time.now(), 1000 / 60])
    })

    test("has a delta of 0 when the frame's timestamp is ahead of now", () => {
        frameData.timestamp = time.now() + 1000

        let seen: number[] = []
        frame.update(({ timestamp, delta }) => (seen = [timestamp, delta]))
        flushFrame()

        expect(seen).toEqual([time.now(), 0])
    })
})
