import { animate, frame, motionValue } from "framer-motion/dom"
import { vgpuEffect } from "../vgpu"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

/**
 * Mirrors vgpu shader units and shared uniforms: a set() method, a gpu
 * resource and no readable values.
 */
function createUnit() {
    return { gpu: {}, set: jest.fn() }
}

beforeAll(() => animate.addEffect(vgpuEffect))
afterAll(() => animate.removeEffect(vgpuEffect))

describe("vgpuEffect", () => {
    it("batches changed values once per frame", async () => {
        const uniforms = createUnit()
        const width = motionValue(100)
        const height = motionValue(200)

        vgpuEffect(uniforms, { width, height })

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
            gpu: {},
            set: () => order.push("set"),
        }

        vgpuEffect(uniforms, { width: motionValue(100) })
        frame.render(() => order.push("render"))

        await nextFrame()

        expect(order).toEqual(["set", "render"])
    })

    it("stops pending and future updates on cleanup", async () => {
        const uniforms = createUnit()
        const width = motionValue(100)
        const cleanup = vgpuEffect(uniforms, { width })

        cleanup()
        await nextFrame()

        width.set(200)
        await nextFrame()

        expect(uniforms.set).not.toHaveBeenCalled()
    })

    describe("test()", () => {
        it("claims vgpu subjects", () => {
            expect(vgpuEffect.test(createUnit())).toBe(true)
            expect(vgpuEffect.test({ reflection: {}, set() {} })).toBe(true)
            expect(vgpuEffect.test({ kind: "mesh", set() {} })).toBe(true)
            expect(vgpuEffect.test({ kind: "unlit", set() {} })).toBe(true)
            expect(vgpuEffect.test({ yaw: 0, pitch: 0, set() {} })).toBe(true)
            expect(vgpuEffect.test({ gpu: {}, clearColor: [0, 0, 0, 1] })).toBe(
                true
            )
        })

        it("leaves plain objects and vectors alone", () => {
            expect(vgpuEffect.test({ x: 0, y: 0 })).toBe(false)
            expect(vgpuEffect.test({ x: 0, set() {} })).toBe(false)
            expect(vgpuEffect.test({ clearColor: [0, 0, 0, 1] })).toBe(false)
            expect(vgpuEffect.test(null)).toBe(false)
            expect(vgpuEffect.test(document.createElement("div"))).toBe(false)
        })
    })

    it("animates registered uniforms", async () => {
        const uniforms = createUnit()
        const progress = motionValue(0)

        vgpuEffect(uniforms, { progress })
        await nextFrame()
        uniforms.set.mockClear()

        await animate(uniforms, { progress: 1 }, { duration: 0.001 })
        await nextFrame()

        expect(progress.get()).toBe(1)
        expect(uniforms.set).toHaveBeenLastCalledWith({ progress: 1 })
    })

    it("animates unregistered uniforms from explicit keyframes", async () => {
        const uniforms = createUnit()

        await animate(uniforms, { progress: [0, 1] }, { duration: 0.001 })
        await nextFrame()

        expect(uniforms.set).toHaveBeenLastCalledWith({ progress: 1 })
    })

    it("throws when animating an unregistered uniform", () => {
        expect(() => animate(createUnit(), { progress: 1 })).toThrow()
    })
})

const instant = { duration: 0.001 }
const slow = { duration: 10, ease: "linear" } as const

function lastCall(set: jest.Mock) {
    return set.mock.calls[set.mock.calls.length - 1][0]
}

function quatFromEuler(x: number, y: number, z: number) {
    const c1 = Math.cos(x / 2)
    const s1 = Math.sin(x / 2)
    const c2 = Math.cos(y / 2)
    const s2 = Math.sin(y / 2)
    const c3 = Math.cos(z / 2)
    const s3 = Math.sin(z / 2)
    return new Float32Array([
        s1 * c2 * c3 + c1 * s2 * s3,
        c1 * s2 * c3 - s1 * c2 * s3,
        c1 * c2 * s3 + s1 * s2 * c3,
        c1 * c2 * c3 - s1 * s2 * s3,
    ])
}

/**
 * Mirrors vgpu's SceneNode: readable position/scale/quaternion, write-only
 * Euler rotation, scale as number or vector.
 */
function createNode(rotation = [0, 0, 0]) {
    const node = {
        kind: "mesh",
        position: new Float32Array(3),
        quaternion: quatFromEuler(rotation[0], rotation[1], rotation[2]),
        scale: new Float32Array([1, 1, 1]),
        set: jest.fn((values: Record<string, any>) => {
            values.position && node.position.set(values.position)
            if (values.rotation) {
                node.quaternion = quatFromEuler(
                    ...(values.rotation as [number, number, number])
                )
            }
            if (typeof values.scale === "number") {
                node.scale.fill(values.scale)
            } else if (values.scale) {
                node.scale.set(values.scale)
            }
        }),
    }
    return node
}

function createSubject<T extends object>(state: T) {
    return {
        kind: "scene",
        ...state,
        set: jest.fn(function (this: any, values: Record<string, unknown>) {
            Object.assign(this, values)
        }),
    }
}

describe("animate() with vgpuEffect: nested bindings", () => {
    it("animates struct members via dot-path keys", async () => {
        const wave = createUnit()

        await animate(
            wave,
            { "params.time": [0, 1], "params.speed": [1, 2] },
            instant
        )
        await nextFrame()

        expect(wave.set).toHaveBeenLastCalledWith({
            params: { time: 1, speed: 2 },
        })
    })

    it("batches multiple bindings into a single set() per frame", async () => {
        const cube = createUnit()

        await animate(
            cube,
            { "params.time": [0, 1], "material.roughness": [0, 0.5] },
            instant
        )
        await nextFrame()

        expect(lastCall(cube.set)).toEqual({
            params: { time: 1 },
            material: { roughness: 0.5 },
        })
    })

    it("reads initial values from ShaderMaterial.values", async () => {
        const material = {
            kind: "shader",
            values: { params: { intensity: 2 } },
            set: jest.fn(),
        }

        const animation = animate(material, { "params.intensity": 4 }, slow)
        await nextFrame()

        expect(material.set.mock.calls[0][0].params.intensity).toBeCloseTo(2, 1)
        animation.stop()
    })

    it("animates whole vectors from numeric strings", async () => {
        const wave = createUnit()

        await animate(wave, { "params.mouse": ["0 0", "1 1"] }, instant)
        await nextFrame()

        expect(wave.set).toHaveBeenLastCalledWith({
            params: { mouse: [1, 1] },
        })
    })

    it("animates vector components once the vector is known", async () => {
        const wave = createUnit()

        await animate(wave, { "params.mouse": ["0 0", "1 1"] }, instant)
        await animate(wave, { "params.mouseX": 0 }, instant)
        await nextFrame()

        expect(wave.set).toHaveBeenLastCalledWith({
            params: { mouse: [0, 1] },
        })
    })

    it("treats axis-suffixed keys as plain members when no vector exists", async () => {
        const uniforms = createUnit()

        await animate(uniforms, { offsetX: [0, 1] }, instant)
        await nextFrame()

        expect(uniforms.set).toHaveBeenLastCalledWith({ offsetX: 1 })
    })
})

describe("animate() with vgpuEffect: readable subjects", () => {
    it("reads initial scalar values from the subject", async () => {
        const camera = createSubject({ fov: 45, near: 0.1 })

        const animation = animate(camera, { fov: 90 }, slow)
        await nextFrame()

        expect(camera.set.mock.calls[0][0].fov).toBeCloseTo(45, 0)
        animation.stop()
    })

    it("animates scalars to their target", async () => {
        const camera = createSubject({ fov: 45 })

        await animate(camera, { fov: 90 }, instant)
        await nextFrame()

        expect(camera.fov).toBe(90)
    })

    it("animates orbit controls state and target components", async () => {
        const controls = createSubject({
            yaw: 0,
            pitch: 0,
            distance: 5,
            target: new Float32Array(3),
        })

        await animate(controls, { yaw: 1, distance: 8, targetX: 2 }, instant)
        await nextFrame()

        expect(lastCall(controls.set)).toEqual({
            yaw: 1,
            distance: 8,
            target: [2, 0, 0],
        })
    })

    it("animates light direction components and intensity", async () => {
        const light = createSubject({
            direction: new Float32Array([0, -1, 0]),
            intensity: 1,
        })

        await animate(light, { directionX: 1, intensity: 0.5 }, instant)
        await nextFrame()

        expect(lastCall(light.set)).toEqual({
            direction: [1, -1, 0],
            intensity: 0.5,
        })
    })
})

describe("animate() with vgpuEffect: scene nodes", () => {
    it("animates position via x, y, z", async () => {
        const node = createNode()

        await animate(node, { x: 1, z: 3 }, instant)
        await nextFrame()

        expect(lastCall(node.set)).toEqual({ position: [1, 0, 3] })
        expect(Array.from(node.position)).toEqual([1, 0, 3])
    })

    it("reads the initial position from the node", async () => {
        const node = createNode()
        node.position.set([2, 0, 0])

        const animation = animate(node, { x: 4 }, slow)
        await nextFrame()

        expect(node.set.mock.calls[0][0].position[0]).toBeCloseTo(2, 0)
        animation.stop()
    })

    it("animates uniform and per-axis scale", async () => {
        const node = createNode()

        await animate(node, { scale: 2 }, instant)
        await nextFrame()
        expect(lastCall(node.set)).toEqual({ scale: 2 })

        await animate(node, { scaleX: 3 }, instant)
        await nextFrame()
        expect(lastCall(node.set)).toEqual({ scale: [3, 2, 2] })
    })

    it("animates rotation in degrees and preserves other axes", async () => {
        const node = createNode()

        await animate(node, { rotateY: 90 }, instant)
        await nextFrame()

        let { rotation } = lastCall(node.set)
        expect(rotation[0]).toBeCloseTo(0)
        expect(rotation[1]).toBeCloseTo(Math.PI / 2)
        expect(rotation[2]).toBeCloseTo(0)

        await animate(node, { rotateX: 45 }, instant)
        await nextFrame()

        rotation = lastCall(node.set).rotation
        expect(rotation[0]).toBeCloseTo(Math.PI / 4)
        expect(rotation[1]).toBeCloseTo(Math.PI / 2)
    })

    it("derives the initial rotation from the node quaternion", async () => {
        const node = createNode([0.3, Math.PI / 4, -0.2])

        const animation = animate(node, { rotateY: 90 }, slow)
        await nextFrame()

        const { rotation } = node.set.mock.calls[0][0]
        expect(rotation[0]).toBeCloseTo(0.3)
        expect(rotation[1]).toBeCloseTo(Math.PI / 4, 1)
        expect(rotation[2]).toBeCloseTo(-0.2)
        animation.stop()
    })
})

describe("animate() with vgpuEffect: colors", () => {
    it("animates CSS colors into linear RGB", async () => {
        const material = createSubject({
            color: new Float32Array([1, 1, 1]),
            opacity: 1,
        })

        await animate(material, { color: "#808080", opacity: 0.5 }, instant)
        await nextFrame()

        const { color, opacity } = lastCall(material.set)
        expect(opacity).toBe(0.5)
        expect(color).toHaveLength(3)
        // 128/255 in sRGB is ~0.2159 linear
        color.forEach((channel: number) =>
            expect(channel).toBeCloseTo(0.2159, 3)
        )
    })

    it("reads the initial color from the subject", async () => {
        const material = createSubject({ color: new Float32Array([1, 0, 0]) })

        const animation = animate(material, { color: "#0000ff" }, slow)
        await nextFrame()

        const { color } = material.set.mock.calls[0][0] as any
        expect(color[0]).toBeCloseTo(1, 1)
        expect(color[1]).toBeCloseTo(0, 1)
        expect(color[2]).toBeCloseTo(0, 1)
        animation.stop()
    })

    it("animates colors on struct members", async () => {
        const wave = createUnit()

        await animate(wave, { "params.tint": ["#000", "#fff"] }, instant)
        await nextFrame()

        expect(wave.set).toHaveBeenLastCalledWith({
            params: { tint: [1, 1, 1] },
        })
    })

    it("writes rgba to four-component vectors without set()", async () => {
        const target = { gpu: {}, clearColor: [0, 0, 0, 1] }

        await animate(target, { clearColor: "rgba(255, 255, 255, 0)" }, instant)
        await nextFrame()

        expect(target.clearColor).toEqual([1, 1, 1, 0])
    })
})

describe("animate() with vgpuEffect: sequences", () => {
    it("animates nodes alongside DOM elements", async () => {
        const node = createNode()
        const element = document.createElement("div")

        await animate([
            [element, { opacity: 0.5 }, instant],
            [node, { x: 2 }, instant],
        ])
        await nextFrame()

        expect(element.style.opacity).toBe("0.5")
        expect(Array.from(node.position)).toEqual([2, 0, 0])
    })

    it("staggers arrays of nodes", async () => {
        const nodes = [createNode(), createNode()]

        await animate(nodes, { x: 2 }, { ...instant, delay: (i) => i * 0.001 })
        await nextFrame()

        nodes.forEach((node) =>
            expect(Array.from(node.position)).toEqual([2, 0, 0])
        )
    })
})
