import { frame, motionValue } from "framer-motion/dom"
import { uniformEffect } from "../vgpu"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("motion/vgpu", () => {
    it("batches changed values once per frame", async () => {
        const uniforms = { set: jest.fn() }
        const width = motionValue(100)
        const height = motionValue(200)

        uniformEffect(uniforms, { width, height })

        expect(uniforms.set).not.toHaveBeenCalled()

        await nextFrame()

        expect(uniforms.set).toHaveBeenCalledTimes(1)
        expect(uniforms.set).toHaveBeenCalledWith({
            width: 100,
            height: 200,
        })

        uniforms.set.mockClear()
        width.set(150)
        width.set(200)
        height.set(300)

        await nextFrame()

        expect(uniforms.set).toHaveBeenCalledTimes(1)
        expect(uniforms.set).toHaveBeenCalledWith({
            width: 200,
            height: 300,
        })
    })

    it("sets values before the render step", async () => {
        const order: string[] = []
        const uniforms = {
            set: () => order.push("set"),
        }

        uniformEffect(uniforms, { width: motionValue(100) })
        frame.render(() => order.push("render"))

        await nextFrame()

        expect(order).toEqual(["set", "render"])
    })

    it("stops pending and future updates on cleanup", async () => {
        const uniforms = { set: jest.fn() }
        const width = motionValue(100)
        const cleanup = uniformEffect(uniforms, { width })

        cleanup()
        await nextFrame()

        width.set(200)
        await nextFrame()

        expect(uniforms.set).not.toHaveBeenCalled()
    })
})
