import { frame, motionValue } from "framer-motion/dom"
import { animate, objectEffect, uniformEffect } from "../three"

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

    it("animates registered uniforms", async () => {
        const uniforms = { opacity: { value: 0 } }
        const opacity = motionValue(0)

        uniformEffect(uniforms, { opacity })
        await nextFrame()

        await animate(uniforms, { opacity: 1 }, { duration: 0.001 })
        await nextFrame()

        expect(opacity.get()).toBe(1)
        expect(uniforms.opacity.value).toBe(1)
    })

    it("animates uniforms without registration", async () => {
        const uniforms = { opacity: { value: 0 } }

        await animate(uniforms, { opacity: 1 }, { duration: 0.001 })
        await nextFrame()

        expect(uniforms.opacity.value).toBe(1)
    })

    it("updates Three.js color uniforms without replacing them", async () => {
        const color = { set: jest.fn() }
        const uniforms = { tint: { value: color } }
        const tint = motionValue("#000")

        uniformEffect(uniforms, { tint })
        await nextFrame()

        await animate(uniforms, { tint: "#fff" }, { duration: 0.001 })
        await nextFrame()

        expect(uniforms.tint.value).toBe(color)
        expect(color.set).toHaveBeenLastCalledWith("#fff")
    })

    it("animates registered Three.js objects", async () => {
        const mesh = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            material: { opacity: 1 },
        }
        const x = motionValue(0)
        const rotateY = motionValue(0)
        const opacity = motionValue(1)

        objectEffect(mesh, { x, rotateY, opacity })
        await nextFrame()

        await animate(
            mesh,
            { x: 2, rotateY: 180, opacity: 0.5 },
            { duration: 0.001 }
        )
        await nextFrame()

        expect(mesh.position.x).toBe(2)
        expect(mesh.rotation.y).toBeCloseTo(Math.PI)
        expect(mesh.material.opacity).toBe(0.5)
    })

    it("animates Three.js objects without registration", async () => {
        const mesh = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            material: { opacity: 1 },
        }

        await animate(
            mesh,
            { x: 2, rotateY: 180, opacity: 0.5 },
            { duration: 0.001 }
        )
        await nextFrame()

        expect(mesh.position.x).toBe(2)
        expect(mesh.rotation.y).toBeCloseTo(Math.PI)
        expect(mesh.material.opacity).toBe(0.5)
    })

    it("reads and mutates Three.js colors", async () => {
        const color = {
            getStyle: () => "#000",
            set: jest.fn(),
        }
        const material = { color }

        await animate(material, { color: "#fff" }, { duration: 0.001 })
        await nextFrame()

        expect(color.set).toHaveBeenLastCalledWith("#fff")
    })
})
