import {
    animate,
    frameData,
    motionValue,
    MotionGlobalConfig,
    processFrame,
    visualElementStore,
} from "framer-motion/dom"
import {
    canvasEffect,
    canvasLayer,
    chromaticAberration,
    defineFXShader,
    goo,
    motionBlur,
    pixelate,
    renderVideo,
} from "../fx"
import { canvasItems, type CanvasLayer } from "../canvas/layer"
import {
    blurSamples,
    defaultPose,
    mixPose,
    poseMatrix,
    poseTravel,
    readPose,
    sweptBounds,
    type CanvasPose,
} from "../canvas/pose"
import { parseUniforms, resolveUniform, writeUniform } from "../canvas/uniforms"
import { CanvasVisualElement } from "../canvas/visual-element"

const pose = (values: Partial<CanvasPose>): CanvasPose => ({
    ...defaultPose,
    ...values,
})

/**
 * Where the matrix puts a point of the element's box.
 */
const apply = (m: Float32Array, x: number, y: number) => [
    m[0] * x + m[3] * y + m[6],
    m[1] * x + m[4] * y + m[7],
]

const expectPoint = (point: number[], x: number, y: number) => {
    expect(point[0]).toBeCloseTo(x, 4)
    expect(point[1]).toBeCloseTo(y, 4)
}

/**
 * Step Motion's clock manually, a frame at a time.
 */
const step = async (ms: number, frame = 1000 / 60) => {
    MotionGlobalConfig.useManualTiming = true
    const end = frameData.timestamp + ms
    let timestamp = frameData.timestamp
    while (timestamp < end) {
        processFrame((timestamp = Math.min(timestamp + frame, end)))
        await Promise.resolve()
    }
}

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
})

describe("poseMatrix", () => {
    test("translates the box's top-left corner to x, y", () => {
        const m = poseMatrix(pose({ x: 10, y: 20 }), 100, 50)
        expectPoint(apply(m, 0, 0), 10, 20)
        expectPoint(apply(m, 100, 50), 110, 70)
    })

    test("rotates and scales around the origin, like CSS", () => {
        const m = poseMatrix(pose({ rotate: 90 }), 100, 50)
        // The centre stays put
        expectPoint(apply(m, 50, 25), 50, 25)
        // The top-left corner swings round to the top-right
        expectPoint(apply(m, 0, 0), 75, -25)

        const scaled = poseMatrix(
            pose({ scale: 2, scaleX: 0.5, originX: 0, originY: 0 }),
            100,
            50
        )
        expectPoint(apply(scaled, 100, 50), 100, 100)
    })

    test("matches the CSS transform Motion would build", () => {
        const values = pose({ x: 30, y: -12, rotate: 33, scale: 1.4 })
        const m = poseMatrix(values, 120, 80)
        // translate(x, y) translate(origin) rotate scale translate(-origin)
        const css = new DOMMatrixLike()
            .translate(30 + 60, -12 + 40)
            .rotate(33)
            .scale(1.4)
            .translate(-60, -40)
        for (const [x, y] of [
            [0, 0],
            [120, 0],
            [120, 80],
        ]) {
            const [ex, ey] = css.apply(x, y)
            expectPoint(apply(m, x, y), ex, ey)
        }
    })
})

describe("pose mixing and travel", () => {
    test("mixPose interpolates every value", () => {
        const mixed = mixPose(
            pose({ x: 0, opacity: 0, rotate: 0 }),
            pose({ x: 100, opacity: 1, rotate: 90 }),
            0.25
        )
        expect(mixed.x).toBe(25)
        expect(mixed.opacity).toBe(0.25)
        expect(mixed.rotate).toBe(22.5)
        expect(mixed.scale).toBe(1)
    })

    test("z, rotateX and rotateY are flat without a perspective", () => {
        const m = poseMatrix(pose({ z: 100, rotateY: 60 }), 100, 50)
        expect([m[2] + 0, m[5] + 0, m[8]]).toEqual([0, 0, 1])
        // cos(60deg) halves the width around the centre
        expectPoint(apply(m, 0, 0), 25, 0)
        expectPoint(apply(m, 100, 50), 75, 50)

        const turned = poseMatrix(pose({ rotateX: 60 }), 100, 50)
        expectPoint(apply(turned, 0, 0), 0, 12.5)
    })

    test("a perspective divides by the distance from the viewer", () => {
        const camera = [400, 200, 150]
        const project = (m: Float32Array, x: number, y: number) => {
            const w = m[2] * x + m[5] * y + m[8]
            return [
                (m[0] * x + m[3] * y + m[6]) / w,
                (m[1] * x + m[4] * y + m[7]) / w,
            ]
        }

        // Half way to the viewer is twice the size, around the camera
        const near = poseMatrix(
            pose({ x: 150, y: 120, z: 200 }),
            100,
            60,
            undefined,
            camera
        )
        expectPoint(project(near, 0, 0), 100, 90)
        expectPoint(project(near, 100, 60), 300, 210)

        // rotateY brings the left side nearer, so it's drawn larger
        const turned = poseMatrix(
            pose({ x: 150, y: 120, rotateY: 60 }),
            100,
            60,
            undefined,
            camera
        )
        const [left, top] = project(turned, 0, 0)
        const [right, farTop] = project(turned, 100, 0)
        expect(left).toBeCloseTo(200 - 25 / (1 - 43.301 / 400), 2)
        expect(right).toBeCloseTo(200 + 25 / (1 + 43.301 / 400), 2)
        expect(top).toBeLessThan(farTop)

        expect(
            poseTravel(
                pose({ x: 150, y: 120 }),
                pose({ x: 150, y: 120, z: 200 }),
                100,
                60,
                camera
            )
        ).toBeCloseTo(Math.hypot(50, 30), 4)
    })

    test("poseTravel is the furthest corner movement", () => {
        expect(poseTravel(pose({}), pose({}), 100, 100)).toBe(0)
        expect(poseTravel(pose({}), pose({ opacity: 0 }), 100, 100)).toBe(0)
        expect(poseTravel(pose({}), pose({ x: 3, y: 4 }), 100, 100)).toBe(5)
        // Spinning 180deg in place moves each corner across the diagonal
        expect(
            poseTravel(pose({}), pose({ rotate: 180 }), 100, 100)
        ).toBeCloseTo(Math.hypot(100, 100), 4)
    })

    test("sweptBounds covers the whole move", () => {
        const [left, top, right, bottom] = sweptBounds(
            pose({ x: 0 }),
            pose({ x: 50, y: 10 }),
            20,
            10
        )
        expect([left, top, right, bottom]).toEqual([0, 0, 70, 20])
    })

    test("blurSamples grows with travel, within limits", () => {
        expect(blurSamples(0.6, 24)).toBe(2)
        expect(blurSamples(10, 24)).toBe(6)
        expect(blurSamples(1000, 24)).toBe(24)
    })

    test("readPose reads numbers and px strings, and fills defaults", () => {
        expect(readPose({ x: "12px", y: 4, opacity: "bad" })).toEqual(
            pose({ x: 12, y: 4 })
        )
    })
})

describe("resolveUniform", () => {
    test("numbers, booleans and arrays", () => {
        expect(resolveUniform(0.5)).toEqual([0.5])
        expect(resolveUniform(true)).toEqual([1])
        expect(resolveUniform([1, 2, 3])).toEqual([1, 2, 3])
        expect(resolveUniform(new Float32Array([1, 2]))).toEqual([1, 2])
    })

    test("motion values, including inside arrays", () => {
        const x = motionValue(0.25)
        expect(resolveUniform(x)).toEqual([0.25])
        expect(resolveUniform([x, 2])).toEqual([0.25, 2])
        x.set(0.75)
        expect(resolveUniform([x, 2])).toEqual([0.75, 2])
        expect(resolveUniform(motionValue([4, 5]))).toEqual([4, 5])
    })

    test("colours as 0-1 RGBA", () => {
        expect(resolveUniform("#ff0000")).toEqual([1, 0, 0, 1])
        expect(resolveUniform("rgba(0, 51, 255, 0.5)")).toEqual([
            0, 0.2, 1, 0.5,
        ])
        expect(resolveUniform("hsl(120, 100%, 50%)")).toEqual([0, 1, 0, 1])
    })

    test("reuses the output array", () => {
        const out: number[] = []
        resolveUniform([1, 2, 3], out)
        expect(resolveUniform(4, out)).toBe(out)
        expect(out).toEqual([4])
    })
})

describe("parseUniforms", () => {
    test("lays out the members of Uniforms as WGSL does", () => {
        const layout = parseUniforms(`
            // struct Uniforms { ignored: f32 }
            struct Uniforms {
                progress: f32,
                tint: vec4f,
                band: vec2<f32>,
                count: i32,
                axis: vec3f,
                spin: mat3x3f,
            }
            fn effect(uv: vec2f) -> vec4f { return element(uv); }
        `)!
        const offsets = [...layout.members].map(([name, info]) => [
            name,
            info.offset,
        ])
        expect(offsets).toEqual([
            ["progress", 0],
            ["tint", 16],
            ["band", 32],
            ["count", 40],
            ["axis", 48],
            ["spin", 64],
        ])
        expect(layout.size).toBe(112)
        expect(layout.members.get("count")!.integer).toBe(true)
    })

    test("is undefined for a shader without Uniforms", () => {
        expect(parseUniforms("fn effect(uv: vec2f) -> vec4f {}")).toBe(
            undefined
        )
    })

    test("writeUniform pads, truncates and rounds to the member's type", () => {
        const { members, size } = parseUniforms(
            "struct Uniforms { tint: vec3f, count: i32, spin: mat3x3f }"
        )!
        const data = new ArrayBuffer(size)
        const floats = new Float32Array(data)
        const ints = new Int32Array(data)
        const scratch: number[] = []

        writeUniform(floats, ints, members.get("tint")!, "#ff0000", scratch)
        expect([...floats.slice(0, 3)]).toEqual([1, 0, 0])

        writeUniform(floats, ints, members.get("count")!, 1.6, scratch)
        expect(ints[3]).toBe(2)

        // Columns of three are padded to four
        writeUniform(
            floats,
            ints,
            members.get("spin")!,
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
            scratch
        )
        expect([...floats.slice(4, 16)]).toEqual([
            1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0,
        ])
    })
})

describe("canvasLayer without HTML-in-canvas", () => {
    test("reports unsupported, leaves the canvas as it was and never throws", () => {
        const canvas = document.createElement("canvas")
        const child = document.createElement("div")
        canvas.appendChild(child)

        const layer = canvasLayer(canvas, { motionBlur: 0.5 })

        expect(layer.supported).toBe(false)
        expect(canvas.hasAttribute("content")).toBe(false)
        expect(() => {
            layer.add(child, { x: 100 })
            layer.invalidate()
            layer.remove(child)
            layer.destroy()
        }).not.toThrow()
        expect(child.hasAttribute("drawable")).toBe(false)
        expect(layer.has(child)).toBe(false)
        expect(visualElementStore.get(child)).toBeUndefined()
    })

    test("restores a content attribute the canvas already had", () => {
        const canvas = document.createElement("canvas")
        canvas.setAttribute("content", "fallback")
        canvasLayer(canvas)
        expect(canvas.getAttribute("content")).toBe("fallback")
    })

    test("animate() still styles the fallback content", async () => {
        const canvas = document.createElement("canvas")
        const child = document.createElement("div")
        canvas.appendChild(child)
        document.body.appendChild(canvas)
        canvasLayer(canvas).add(child)

        animate(child, { x: 100 }, { duration: 0 })
        await step(50)
        expect(child.style.transform).toBe("translateX(100px)")
        canvas.remove()
    })
})

describe("CanvasVisualElement", () => {
    const setup = (uniforms: string[] = []) => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const invalidate = jest.fn()
        const visualElement = new CanvasVisualElement(
            invalidate,
            (key) => uniforms.includes(key),
            () => 0
        )
        visualElement.mount(element)
        return { element, invalidate, visualElement }
    }

    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
        processFrame(frameData.timestamp)
    })

    afterEach(() => {
        document.body.innerHTML = ""
    })

    test("animate() drives its values instead of the element's transform and opacity", async () => {
        const { element, invalidate, visualElement } = setup()

        animate(
            element,
            { x: [0, 100], rotate: [0, 90], opacity: [1, 0] },
            { duration: 1, ease: "linear" }
        )
        await step(500)

        // Animations start on the next frame, so allow a frame's lag
        expect(visualElement.latestValues.x).toBeCloseTo(50, -1)
        expect(visualElement.latestValues.rotate).toBeCloseTo(45, -1)
        expect(visualElement.latestValues.opacity).toBeCloseTo(0.5, 1)
        expect(element.style.transform).toBe("")
        expect(element.style.opacity).toBe("")
        expect(invalidate).toHaveBeenCalled()

        await step(600)
        expect(visualElement.latestValues.x).toBe(100)
    })

    test("still writes styles the layer doesn't draw", async () => {
        const { element } = setup()
        animate(
            element,
            { x: 10, backgroundColor: "#f00", "--hue": 20 } as any,
            { duration: 0 }
        )
        await step(50)
        expect(element.style.backgroundColor).toBe("rgb(255, 0, 0)")
        expect(element.style.getPropertyValue("--hue")).toBe("20")
        expect(element.style.transform).toBe("")
    })

    test("animates shader uniforms as values, without styling them", async () => {
        const { element, visualElement } = setup(["progress"])
        animate(element, { progress: 1 } as any, {
            duration: 1,
            ease: "linear",
        })
        await step(250)
        expect(visualElement.latestValues.progress).toBeCloseTo(0.25, 1)
        expect((element.style as any).progress).toBeUndefined()
    })

    test("keeps values off WAAPI, so the layer can read them every frame", async () => {
        MotionGlobalConfig.useManualTiming = false
        const animated: Element[] = []
        Object.defineProperty(Element.prototype, "animate", {
            value: function (this: Element) {
                animated.push(this)
                return { cancel() {}, finished: Promise.resolve() }
            },
            writable: true,
            configurable: true,
        })
        try {
            const { element, visualElement } = setup()
            animate(element, { opacity: 0, x: 100 }, { duration: 0.2 })
            await new Promise((resolve) => setTimeout(resolve, 400))
            expect(animated).not.toContain(element)
            expect(visualElement.latestValues.opacity).toBe(0)
            expect(visualElement.latestValues.x).toBe(100)
            // Independent transforms aren't composed onto the element
            expect(element.style.transform).toBe("")
        } finally {
            delete (Element.prototype as any).animate
        }
    })
})

describe("canvasEffect", () => {
    test("binds motion values to an element's layer values", async () => {
        MotionGlobalConfig.useManualTiming = true
        const element = document.createElement("div")
        document.body.appendChild(element)
        const invalidate = jest.fn()
        const visualElement = new CanvasVisualElement(
            invalidate,
            (key) => key === "progress",
            () => 0
        )
        visualElement.mount(element)
        canvasItems.set(element, { visualElement } as any)

        const x = motionValue(10)
        const progress = motionValue(0.5)
        const cleanup = canvasEffect(element, { x, progress })

        expect(canvasEffect.test(element)).toBe(true)
        expect(canvasEffect.get(element, "x")).toBe(x)
        expect(visualElement.latestValues).toMatchObject({
            x: 10,
            progress: 0.5,
        })

        x.set(40)
        await step(20)
        expect(visualElement.latestValues.x).toBe(40)
        expect(invalidate).toHaveBeenCalled()
        expect(element.style.transform).toBe("")

        cleanup()
        expect(visualElement.getValue("x")).toBeUndefined()
        // Left where it was
        expect(visualElement.latestValues.x).toBe(40)
        x.set(80)
        await step(20)
        expect(visualElement.latestValues.x).toBe(40)

        canvasItems.delete(element)
        element.remove()
    })

    test("does nothing for elements outside a layer", () => {
        const element = document.createElement("div")
        const x = motionValue(10)
        const cleanup = canvasEffect(element, { x })
        expect(canvasEffect.test(element)).toBe(false)
        expect(() => cleanup()).not.toThrow()
    })
})

/**
 * A layer that renders as soon as it's invalidated, as a paint would.
 */
function createStubLayer() {
    const callbacks = new Set<(layer: CanvasLayer) => void>()
    const layer: CanvasLayer = {
        canvas: document.createElement("canvas"),
        supported: true,
        ready: Promise.resolve(true),
        onLost: () => () => {},
        motionBlur: 0,
        samples: 24,
        perspective: 0,
        setShaders: () => {},
        unproject: (x: number, y: number) => ({ x, y }),
        add: () => {},
        remove: () => {},
        has: () => false,
        destroy: () => {},
        onRender: (callback) => {
            callbacks.add(callback)
            return () => callbacks.delete(callback)
        },
        invalidate: () =>
            queueMicrotask(() => callbacks.forEach((cb) => cb(layer))),
    }
    return layer
}

describe("renderVideo", () => {
    test("renders every frame at its time, captured in the paint", async () => {
        const layer = createStubLayer()
        const value = motionValue(0)
        const animation = animate(value, [0, 100], {
            duration: 1,
            ease: "linear",
        })
        const frames: [number, number, number][] = []

        const count = await renderVideo(layer, animation, {
            fps: 10,
            onFrame: (canvas, timestamp, duration) => {
                expect(canvas).toBe(layer.canvas)
                frames.push([timestamp, duration, value.get()])
            },
        })

        expect(count).toBe(10)
        expect(frames.map(([t]) => t)).toEqual([
            0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
        ])
        frames.forEach(([timestamp, duration, latest]) => {
            expect(duration).toBe(0.1)
            expect(latest).toBeCloseTo(timestamp * 100, 5)
        })
        // Restores the clock it found
        expect(MotionGlobalConfig.useManualTiming).toBe(false)
    })

    test("steps Motion's frameloop with the frames", async () => {
        const layer = createStubLayer()
        const start = frameData.timestamp
        const times: number[] = []

        await renderVideo(layer, null, {
            fps: 4,
            duration: 1,
            onFrame: () => {
                times.push(frameData.timestamp - start)
            },
        })

        expect(times).toHaveLength(4)
        ;[0, 250, 500, 750].forEach((expected, i) =>
            expect(times[i]).toBeCloseTo(expected, 6)
        )
    })

    test("waits for each frame's sink before rendering the next", async () => {
        const layer = createStubLayer()
        const order: string[] = []
        await renderVideo(layer, null, {
            fps: 2,
            duration: 1,
            onFrame: async (_, timestamp) => {
                order.push("start " + timestamp)
                await new Promise((resolve) => setTimeout(resolve, 10))
                order.push("end " + timestamp)
            },
        })
        expect(order).toEqual(["start 0", "end 0", "start 0.5", "end 0.5"])
    })

    test("rejects without support or a finite duration", async () => {
        const layer = { ...createStubLayer(), supported: false }
        await expect(
            renderVideo(layer, null, { duration: 1, onFrame: () => {} })
        ).rejects.toThrow()
        await expect(
            renderVideo(createStubLayer(), null, { onFrame: () => {} })
        ).rejects.toThrow()
    })

    test("can be aborted", async () => {
        const controller = new AbortController()
        let frames = 0
        await expect(
            renderVideo(createStubLayer(), null, {
                fps: 10,
                duration: 1,
                signal: controller.signal,
                onFrame: () => {
                    ++frames === 3 && controller.abort()
                },
            })
        ).rejects.toThrow()
        expect(frames).toBe(3)
        expect(MotionGlobalConfig.useManualTiming).toBe(false)
    })
})

/**
 * A minimal 2D affine matrix, as JSDOM has no DOMMatrix.
 */
class DOMMatrixLike {
    constructor(public m = [1, 0, 0, 1, 0, 0]) {}
    multiply([a2, b2, c2, d2, e2, f2]: number[]) {
        const [a, b, c, d, e, f] = this.m
        return new DOMMatrixLike([
            a * a2 + c * b2,
            b * a2 + d * b2,
            a * c2 + c * d2,
            b * c2 + d * d2,
            a * e2 + c * f2 + e,
            b * e2 + d * f2 + f,
        ])
    }
    translate(x: number, y: number) {
        return this.multiply([1, 0, 0, 1, x, y])
    }
    rotate(degrees: number) {
        const r = (degrees * Math.PI) / 180
        return this.multiply([
            Math.cos(r),
            Math.sin(r),
            -Math.sin(r),
            Math.cos(r),
            0,
            0,
        ])
    }
    scale(s: number) {
        return this.multiply([s, 0, 0, s, 0, 0])
    }
    apply(x: number, y: number) {
        const [a, b, c, d, e, f] = this.m
        return [a * x + c * y + e, b * x + d * y + f]
    }
}

describe("effects", () => {
    test("motionBlur() is a marker, not a shader", () => {
        expect(motionBlur()).toEqual({ motionBlur: 0.5, samples: undefined })
        expect(motionBlur({ strength: 1, samples: 8 })).toEqual({
            motionBlur: 1,
            samples: 8,
        })
    })

    test("defineFXShader() makes an effect with default uniforms", () => {
        const amount = motionValue(1)
        const wave = defineFXShader("wgsl", { amount: 2, speed: 3 })
        expect(wave()).toEqual({
            wgsl: "wgsl",
            uniforms: { amount: 2, speed: 3 },
        })
        expect(wave({ amount })).toEqual({
            wgsl: "wgsl",
            uniforms: { amount, speed: 3 },
        })
    })

    test("built-in effects name every member of their Uniforms", () => {
        for (const effect of [chromaticAberration(), pixelate(), goo()]) {
            const members = [...parseUniforms(effect.wgsl!)!.members.keys()]
            expect(Object.keys(effect.uniforms!)).toEqual(members)
        }
    })
})
