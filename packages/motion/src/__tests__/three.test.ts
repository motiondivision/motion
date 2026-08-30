import { frame, motionValue } from "framer-motion/dom"
import { uniformEffect } from "../three"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("motion/three", () => {
    it("updates Three.js uniform values once per frame", async () => {
        const uniforms = {
            opacity: { value: 0 },
            scale: { value: 1 },
        }
        const opacity = motionValue(0.5)
        const scale = motionValue(2)

        uniformEffect(uniforms, { opacity, scale })

        expect(uniforms.opacity.value).toBe(0)
        expect(uniforms.scale.value).toBe(1)

        await nextFrame()

        expect(uniforms.opacity.value).toBe(0.5)
        expect(uniforms.scale.value).toBe(2)

        opacity.set(0.75)
        opacity.set(1)
        scale.set(3)

        await nextFrame()

        expect(uniforms.opacity.value).toBe(1)
        expect(uniforms.scale.value).toBe(3)
    })

    it("sets values before the render step", async () => {
        const order: string[] = []
        const uniform = { value: 0 }

        Object.defineProperty(uniform, "value", {
            set: () => order.push("set"),
        })

        uniformEffect({ opacity: uniform }, { opacity: motionValue(1) })
        frame.render(() => order.push("render"))

        await nextFrame()

        expect(order).toEqual(["set", "render"])
    })

    it("stops pending and future updates on cleanup", async () => {
        const uniforms = { opacity: { value: 0 } }
        const opacity = motionValue(0.5)
        const cleanup = uniformEffect(uniforms, { opacity })

        cleanup()
        await nextFrame()

        opacity.set(1)
        await nextFrame()

        expect(uniforms.opacity.value).toBe(0)
    })
})
