import { animate, frame, motionValue } from "framer-motion/dom"
import { threeEffect } from "../three"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const createMesh = () => ({
    isObject3D: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    material: { isMaterial: true, opacity: 1 },
})

describe("threeEffect", () => {
    it("updates Three.js uniform values once per frame", async () => {
        const uniforms = {
            opacity: { value: 0 },
            scale: { value: 1 },
        }
        const opacity = motionValue(0.5)
        const scale = motionValue(2)

        threeEffect(uniforms, { opacity, scale })

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

        threeEffect({ opacity: uniform }, { opacity: motionValue(1) })
        frame.render(() => order.push("render"))

        await nextFrame()

        expect(order).toEqual(["set", "render"])
    })

    it("stops pending and future updates on cleanup", async () => {
        const uniforms = { opacity: { value: 0 } }
        const opacity = motionValue(0.5)
        const cleanup = threeEffect(uniforms, { opacity })

        cleanup()
        await nextFrame()

        opacity.set(1)
        await nextFrame()

        expect(uniforms.opacity.value).toBe(0)
    })

    it("binds motion values to object shorthands and materials", async () => {
        const mesh = createMesh()
        const x = motionValue(2)
        const rotateY = motionValue(180)
        const opacity = motionValue(0.5)

        threeEffect(mesh, { x, rotateY, opacity })
        await nextFrame()

        expect(mesh.position.x).toBe(2)
        expect(mesh.rotation.y).toBeCloseTo(Math.PI)
        expect(mesh.material.opacity).toBe(0.5)
    })

    it("binds motion values to TSL uniform nodes", async () => {
        const color = { getStyle: () => "#000", set: jest.fn() }
        const tint = { value: color }

        threeEffect(tint, { value: motionValue("#fff") })
        await nextFrame()

        expect(tint.value).toBe(color)
        expect(color.set).toHaveBeenLastCalledWith("#fff")
    })

    describe("test()", () => {
        it("claims objects, materials and uniforms", () => {
            expect(threeEffect.test(createMesh())).toBe(true)
            expect(threeEffect.test({ isMaterial: true, opacity: 1 })).toBe(
                true
            )
            expect(threeEffect.test({ progress: { value: 0 } })).toBe(true)
        })

        it("leaves vectors, colors and plain objects alone", () => {
            expect(threeEffect.test({ x: 0, y: 0, z: 0 })).toBe(false)
            expect(threeEffect.test({ r: 1, g: 1, b: 1 })).toBe(false)
            expect(threeEffect.test({ value: 0 })).toBe(false)
            expect(threeEffect.test({})).toBe(false)
            expect(threeEffect.test(null)).toBe(false)
            expect(threeEffect.test(document.createElement("div"))).toBe(false)
        })
    })

    describe("read()", () => {
        it("reads transforms in degrees and colors as styles", () => {
            const mesh = {
                ...createMesh(),
                rotation: { x: 0, y: Math.PI, z: 0 },
                material: {
                    isMaterial: true,
                    color: { getStyle: () => "#000" },
                    normalScale: { x: 1, y: 2 },
                },
            }

            expect(threeEffect.read(mesh, "x")).toBe(0)
            expect(threeEffect.read(mesh, "rotateY")).toBeCloseTo(180)
            expect(threeEffect.read(mesh, "scale")).toBe(1)
            expect(threeEffect.read(mesh, "color")).toBe("#000")
            expect(threeEffect.read(mesh, "normalScaleY")).toBe(2)
            expect(threeEffect.read(mesh, "missing")).toBeUndefined()
        })

        it("reads uniforms and uniform components", () => {
            const uniforms = {
                progress: { value: 0.5 },
                mouse: { value: { x: 1, y: 2 } },
            }

            expect(threeEffect.read(uniforms, "progress")).toBe(0.5)
            expect(threeEffect.read(uniforms, "mouseY")).toBe(2)
        })
    })
})

describe("animate() with threeEffect", () => {
    beforeAll(() => animate.addEffect(threeEffect))
    afterAll(() => animate.removeEffect(threeEffect))

    it("animates registered uniforms", async () => {
        const uniforms = { opacity: { value: 0 } }
        const opacity = motionValue(0)

        threeEffect(uniforms, { opacity })
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

    it("animates TSL node material uniforms in favour of plain properties", async () => {
        const nodeColor = { getStyle: () => "#000", set: jest.fn() }
        const material = {
            isMaterial: true,
            color: { getStyle: () => "#000", set: jest.fn() },
            colorNode: { isUniformNode: true, value: nodeColor },
            opacityNode: { isUniformNode: true, value: 0 },
        }

        await animate(
            material,
            { color: "#fff", opacity: 1 },
            { duration: 0.001 }
        )
        await nextFrame()

        expect(nodeColor.set).toHaveBeenLastCalledWith("#fff")
        expect(material.color.set).not.toHaveBeenCalled()
        expect(material.opacityNode.value).toBe(1)
    })

    it("ignores non-uniform nodes when resolving material values", async () => {
        const material = {
            isMaterial: true,
            color: { getStyle: () => "#000", set: jest.fn() },
            colorNode: { value: 0 },
        }

        await animate(material, { color: "#fff" }, { duration: 0.001 })
        await nextFrame()

        expect(material.color.set).toHaveBeenLastCalledWith("#fff")
        expect(material.colorNode.value).toBe(0)
    })

    it("animates TSL node material uniforms via the mesh", async () => {
        const mesh = {
            isObject3D: true,
            position: { x: 0, y: 0, z: 0 },
            material: {
                isMaterial: true,
                opacity: 1,
                opacityNode: { isUniformNode: true, value: 1 },
            },
        }

        await animate(mesh, { x: 2, opacity: 0.5 }, { duration: 0.001 })
        await nextFrame()

        expect(mesh.position.x).toBe(2)
        expect(mesh.material.opacityNode.value).toBe(0.5)
        expect(mesh.material.opacity).toBe(1)
    })

    it("updates Three.js color uniforms without replacing them", async () => {
        const color = { set: jest.fn() }
        const uniforms = { tint: { value: color } }
        const tint = motionValue("#000")

        threeEffect(uniforms, { tint })
        await nextFrame()

        await animate(uniforms, { tint: "#fff" }, { duration: 0.001 })
        await nextFrame()

        expect(uniforms.tint.value).toBe(color)
        expect(color.set).toHaveBeenLastCalledWith("#fff")
    })

    it("animates registered Three.js objects", async () => {
        const mesh = createMesh()
        const x = motionValue(0)
        const rotateY = motionValue(0)
        const opacity = motionValue(1)

        threeEffect(mesh, { x, rotateY, opacity })
        await nextFrame()

        await animate(
            mesh,
            { x: 2, rotateY: 180, opacity: 0.5 },
            { duration: 0.001 }
        )
        await nextFrame()

        expect(x.get()).toBe(2)
        expect(mesh.position.x).toBe(2)
        expect(mesh.rotation.y).toBeCloseTo(Math.PI)
        expect(mesh.material.opacity).toBe(0.5)
    })

    it("animates Three.js objects without registration", async () => {
        const mesh = createMesh()

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
        const material = { isMaterial: true, color }

        await animate(material, { color: "#fff" }, { duration: 0.001 })
        await nextFrame()

        expect(color.set).toHaveBeenLastCalledWith("#fff")
    })

    it("animates vectors as plain objects", async () => {
        const mesh = createMesh()

        await animate(mesh.position, { x: 2 }, { duration: 0.001 })

        expect(mesh.position.x).toBe(2)
    })

    it("animates meshes alongside DOM elements in a sequence", async () => {
        const mesh = createMesh()
        const element = document.createElement("div")

        await animate([
            [element, { opacity: 0.5 }, { duration: 0.001 }],
            [mesh, { x: 2 }, { duration: 0.001 }],
        ])
        await nextFrame()

        expect(element.style.opacity).toBe("0.5")
        expect(mesh.position.x).toBe(2)
    })
})
