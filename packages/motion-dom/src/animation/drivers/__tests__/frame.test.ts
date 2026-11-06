import { frame } from "../../../frameloop"
import { frameloopDriver } from "../frame"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

describe("frameloopDriver", () => {
    it("updates every running driver once a frame", async () => {
        const a = jest.fn()
        const b = jest.fn()
        const driverA = frameloopDriver(a)
        const driverB = frameloopDriver(b)

        driverA.start()
        driverB.start()
        driverA.start()
        await nextFrame()
        await nextFrame()

        expect(a).toHaveBeenCalledTimes(2)
        expect(b).toHaveBeenCalledTimes(2)
        expect(typeof a.mock.calls[0][0]).toBe("number")

        driverA.stop()
        await nextFrame()

        expect(a).toHaveBeenCalledTimes(2)
        expect(b).toHaveBeenCalledTimes(3)
        driverB.stop()
    })

    it("starts a driver started during an update on the next frame", async () => {
        const later = jest.fn()
        const laterDriver = frameloopDriver(later)
        const driver = frameloopDriver(() => {
            laterDriver.start()
            driver.stop()
        })

        driver.start()
        await nextFrame()
        expect(later).not.toHaveBeenCalled()

        await nextFrame()
        expect(later).toHaveBeenCalledTimes(1)
        laterDriver.stop()
    })

    it("updates once without keepAlive", async () => {
        const update = jest.fn()
        frameloopDriver(update).start(false)

        await nextFrame()
        await nextFrame()
        expect(update).toHaveBeenCalledTimes(1)
    })
})
