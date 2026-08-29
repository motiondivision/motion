import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { uniformEffect } from "../uniform"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("uniformEffect", () => {
    it("sets initial values in a single call", async () => {
        const subject = { set: jest.fn() }

        uniformEffect(subject, {
            width: motionValue(100),
            height: motionValue(200),
        })

        expect(subject.set).not.toHaveBeenCalled()

        await nextFrame()

        expect(subject.set).toHaveBeenCalledTimes(1)
        expect(subject.set).toHaveBeenCalledWith({
            width: 100,
            height: 200,
        })
    })

    it("batches changed values once per frame", async () => {
        const subject = { set: jest.fn() }
        const width = motionValue(100)
        const height = motionValue(200)

        uniformEffect(subject, { width, height })
        await nextFrame()
        subject.set.mockClear()

        width.set(150)
        width.set(200)
        height.set(300)

        expect(subject.set).not.toHaveBeenCalled()

        await nextFrame()

        expect(subject.set).toHaveBeenCalledTimes(1)
        expect(subject.set).toHaveBeenCalledWith({
            width: 200,
            height: 300,
        })

        subject.set.mockClear()
        width.set(250)
        await nextFrame()

        expect(subject.set).toHaveBeenCalledWith({ width: 250 })
    })

    it("batches separate effects on the same subject", async () => {
        const subject = { set: jest.fn() }

        uniformEffect(subject, { width: motionValue(100) })
        uniformEffect(subject, { height: motionValue(200) })

        await nextFrame()

        expect(subject.set).toHaveBeenCalledTimes(1)
        expect(subject.set).toHaveBeenCalledWith({
            width: 100,
            height: 200,
        })
    })

    it("sets values before the render step", async () => {
        const order: string[] = []
        const subject = {
            set: () => order.push("set"),
        }

        uniformEffect(subject, { width: motionValue(100) })
        frame.render(() => order.push("render"))

        await nextFrame()

        expect(order).toEqual(["set", "render"])
    })

    it("stops pending and future updates on cleanup", async () => {
        const subject = { set: jest.fn() }
        const width = motionValue(100)
        const cleanup = uniformEffect(subject, { width })

        cleanup()
        await nextFrame()

        expect(subject.set).not.toHaveBeenCalled()

        width.set(200)
        await nextFrame()

        expect(subject.set).not.toHaveBeenCalled()
    })
})
