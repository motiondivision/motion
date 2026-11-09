import { frame } from "framer-motion/dom"
import { isFrontFacing, projectRect, rectToQuad } from "../html-plane"
import { htmlPlane } from "../three"

/**
 * The package's own `three` entry shadows the library for type resolution
 * here, and the installed three.js types predate ExternalTexture.
 */
const THREE: any = require("three")

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const canvasWidth = 800
const canvasHeight = 600

/**
 * A camera that draws one world unit as one CSS pixel at z = 0.
 */
function createCamera() {
    const fov = 30
    const camera = new THREE.PerspectiveCamera(
        fov,
        canvasWidth / canvasHeight,
        1,
        10000
    )
    camera.position.z = canvasHeight / 2 / Math.tan((fov * Math.PI) / 360)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    return camera
}

/**
 * Where three.js draws a point in the mesh's local space, in canvas pixels.
 */
function drawn(mesh: any, camera: any, x: number, y: number) {
    mesh.updateWorldMatrix(true, false)
    const p = new THREE.Vector3(x, y, 0)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera)
    return [((p.x + 1) / 2) * canvasWidth, ((1 - p.y) / 2) * canvasHeight]
}

function clipMatrix(mesh: any, camera: any) {
    mesh.updateWorldMatrix(true, false)
    return new THREE.Matrix4()
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(mesh.matrixWorld).elements
}

/**
 * Applies a column-major matrix3d to a point, with the perspective divide.
 */
function apply(m: number[], x: number, y: number) {
    const w = m[3] * x + m[7] * y + m[15]
    return [
        (m[0] * x + m[4] * y + m[12]) / w,
        (m[1] * x + m[5] * y + m[13]) / w,
    ]
}

function expectPoint(actual: number[], expected: number[]) {
    expect(actual[0]).toBeCloseTo(expected[0], 6)
    expect(actual[1]).toBeCloseTo(expected[1], 6)
}

describe("projectRect", () => {
    it("projects a plane's corners where three.js draws them", () => {
        const camera = createCamera()
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 200))
        mesh.position.set(-120, 40, -50)
        mesh.rotation.set(0.2, 0.61, -0.1)

        const out = new Float64Array(8)
        const isInFront = projectRect(
            clipMatrix(mesh, camera),
            -150,
            -100,
            150,
            100,
            canvasWidth,
            canvasHeight,
            out
        )

        expect(isInFront).toBe(true)
        expectPoint([out[0], out[1]], drawn(mesh, camera, -150, 100))
        expectPoint([out[2], out[3]], drawn(mesh, camera, 150, 100))
        expectPoint([out[4], out[5]], drawn(mesh, camera, 150, -100))
        expectPoint([out[6], out[7]], drawn(mesh, camera, -150, -100))
    })

    it("returns false when a corner is behind the camera", () => {
        const camera = createCamera()
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 200))

        mesh.position.z = camera.position.z + 10
        const out = new Float64Array(8)
        const behind = (m: any) =>
            projectRect(
                clipMatrix(m, camera),
                -150,
                -100,
                150,
                100,
                canvasWidth,
                canvasHeight,
                out
            )
        expect(behind(mesh)).toBe(false)

        /**
         * Straddling the camera: the far edge is in front, the near edge
         * behind.
         */
        mesh.position.z = camera.position.z - 50
        mesh.rotation.x = -Math.PI / 2
        expect(behind(mesh)).toBe(false)
    })
})

describe("rectToQuad", () => {
    it("maps the element's border box onto the quad", () => {
        const quad = new Float64Array([110, 90, 420, 140, 400, 330, 90, 300])
        const m = rectToQuad(300, 200, quad)!

        expectPoint(apply(m, 0, 0), [110, 90])
        expectPoint(apply(m, 300, 0), [420, 140])
        expectPoint(apply(m, 300, 200), [400, 330])
        expectPoint(apply(m, 0, 200), [90, 300])
    })

    it("maps points inside the element through perspective", () => {
        const camera = createCamera()
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 200))
        mesh.rotation.y = 0.61
        mesh.position.x = 80

        const quad = new Float64Array(8)
        projectRect(
            clipMatrix(mesh, camera),
            -150,
            -100,
            150,
            100,
            canvasWidth,
            canvasHeight,
            quad
        )
        const m = rectToQuad(300, 200, quad)!

        /**
         * A button 40px from the left and 150px from the top of the
         * element. In the plane's local space, y is up from its centre.
         */
        expectPoint(apply(m, 40, 150), drawn(mesh, camera, -110, -50))
        expectPoint(apply(m, 150, 100), drawn(mesh, camera, 0, 0))
    })

    it("returns undefined for an edge-on plane", () => {
        const quad = new Float64Array([100, 100, 100, 100, 100, 300, 100, 300])
        expect(rectToQuad(300, 200, quad)).toBeUndefined()
    })
})

describe("isFrontFacing", () => {
    it("detects a plane turned away from the camera", () => {
        const camera = createCamera()
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 200))
        const quad = new Float64Array(8)
        const project = () =>
            projectRect(
                clipMatrix(mesh, camera),
                -150,
                -100,
                150,
                100,
                canvasWidth,
                canvasHeight,
                quad
            )

        mesh.rotation.y = 1.2
        project()
        expect(isFrontFacing(quad)).toBe(true)

        mesh.rotation.y = 2
        project()
        expect(isFrontFacing(quad)).toBe(false)
    })
})

function setSize(element: HTMLElement, width: number, height: number) {
    Object.defineProperty(element, "offsetWidth", {
        configurable: true,
        get: () => width,
    })
    Object.defineProperty(element, "offsetHeight", {
        configurable: true,
        get: () => height,
    })
}

function createElement() {
    const home = document.createElement("section")
    const element = document.createElement("div")
    home.appendChild(element)
    document.body.appendChild(home)
    setSize(element, 300, 200)
    return { home, element }
}

describe("htmlPlane without HTML-in-canvas", () => {
    it("fails soft: hides the plane and leaves the element alone", () => {
        const canvas = document.createElement("canvas")
        const renderer = {
            domElement: canvas,
            getContext: () => null,
            resetState: jest.fn(),
        }
        const { home, element } = createElement()
        let plane: any

        expect(() => {
            plane = htmlPlane(element, {
                three: THREE,
                renderer,
                camera: createCamera(),
            })
        }).not.toThrow()

        expect(plane.isSupported).toBe(false)
        expect(plane.visible).toBe(false)
        expect(plane.isMesh).toBe(true)
        expect(plane.texture.isExternalTexture).toBe(true)
        expect(plane.geometry.parameters).toMatchObject({
            width: 300,
            height: 200,
        })
        expect(element.parentNode).toBe(home)
        expect(element.hasAttribute("drawable")).toBe(false)
        expect(canvas.hasAttribute("content")).toBe(false)

        const scene = new THREE.Scene()
        scene.add(plane)
        expect(() => plane.dispose()).not.toThrow()
        expect(plane.parent).toBe(null)
    })
})

/**
 * A canvas and WebGL context with the shipped HTML-in-canvas API.
 */
function createRenderer() {
    const canvas = document.createElement("canvas") as any
    canvas.width = canvasWidth * 2
    canvas.height = canvasHeight * 2
    Object.defineProperty(canvas, "clientWidth", { get: () => canvasWidth })
    Object.defineProperty(canvas, "clientHeight", { get: () => canvasHeight })
    canvas.requestPaint = jest.fn()
    canvas.updateElementGeometry = jest.fn()
    canvas.clearElementGeometry = jest.fn()
    canvas.getElementImageDefaultSize = (element: HTMLElement) => ({
        width: element.offsetWidth * 2,
        height: element.offsetHeight * 2,
    })
    document.body.appendChild(canvas)

    const gl: any = {
        TEXTURE_2D: 1,
        SRGB8_ALPHA8: 2,
        RGBA: 3,
        UNSIGNED_BYTE: 4,
        UNPACK_FLIP_Y_WEBGL: 5,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 6,
    }
    for (const name of [
        "createTexture",
        "deleteTexture",
        "bindTexture",
        "texImage2D",
        "texParameteri",
        "texParameterf",
        "pixelStorei",
        "generateMipmap",
        "getExtension",
        "texElementSubImage2D",
    ]) {
        gl[name] = jest.fn()
    }
    gl.createTexture.mockImplementation(() => ({}))

    const renderer = {
        domElement: canvas,
        getContext: () => gl,
        resetState: jest.fn(),
    }

    return { canvas, gl, renderer }
}

class MockDOMMatrix {
    constructor(public values: number[]) {}
}

describe("htmlPlane with HTML-in-canvas", () => {
    const { DOMMatrix } = window as any

    beforeAll(() => {
        ;(window as any).DOMMatrix = MockDOMMatrix
    })

    afterAll(() => {
        ;(window as any).DOMMatrix = DOMMatrix
    })

    function paint(canvas: any, changedElements?: Element[]) {
        const event = new Event("paint") as any
        if (changedElements) event.changedElements = changedElements
        canvas.dispatchEvent(event)
    }

    function setup() {
        const { canvas, gl, renderer } = createRenderer()
        const camera = createCamera()
        const scene = new THREE.Scene()
        const onRender = jest.fn()
        const a = createElement()
        const b = createElement()
        const options = { three: THREE, renderer, camera, onRender }
        const planeA = htmlPlane(a.element, options)
        const planeB = htmlPlane(b.element, options)
        scene.add(planeA, planeB)

        return {
            canvas,
            gl,
            renderer,
            camera,
            scene,
            onRender,
            a,
            b,
            planeA,
            planeB,
        }
    }

    it("moves elements into the canvas and draws them on paint", () => {
        const { canvas, gl, renderer, onRender, a, b, planeA, planeB } = setup()

        expect(planeA.isSupported).toBe(true)
        expect(planeA.visible).toBe(true)
        expect(a.element.parentNode).toBe(canvas)
        expect(b.element.parentNode).toBe(canvas)
        expect(a.element.hasAttribute("drawable")).toBe(true)
        expect(canvas.getAttribute("content") ?? canvas.content).toBe(
            "drawable"
        )
        expect(canvas.requestPaint).toHaveBeenCalled()
        expect(planeA.texture.sourceTexture).toBeTruthy()
        expect(planeA.texture.sourceTexture).not.toBe(
            planeB.texture.sourceTexture
        )

        renderer.resetState.mockClear()
        paint(canvas)

        expect(gl.texElementSubImage2D).toHaveBeenCalledTimes(2)
        expect(gl.texElementSubImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            a.element
        )

        /**
         * Storage is sized by getElementImageDefaultSize.
         */
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D,
            0,
            gl.SRGB8_ALPHA8,
            600,
            400,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        )
        expect(renderer.resetState).toHaveBeenCalledTimes(1)

        /**
         * Shared callbacks run once a paint.
         */
        expect(onRender).toHaveBeenCalledTimes(1)

        /**
         * Only elements that changed upload again.
         */
        gl.texElementSubImage2D.mockClear()
        paint(canvas, [b.element])
        expect(gl.texElementSubImage2D).toHaveBeenCalledTimes(1)
        expect(gl.texElementSubImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            b.element
        )

        gl.texElementSubImage2D.mockClear()
        onRender.mockClear()
        paint(canvas, [])
        expect(gl.texElementSubImage2D).not.toHaveBeenCalled()
        expect(onRender).not.toHaveBeenCalled()

        planeA.dispose()
        planeB.dispose()
    })

    it("places elements where their planes are drawn", async () => {
        const { canvas, camera, a, planeA, planeB } = setup()

        await nextFrame()
        expect(canvas.updateElementGeometry).not.toHaveBeenCalled()

        paint(canvas)
        planeA.position.x = -200
        planeA.rotation.y = 0.61
        await nextFrame()

        const calls = canvas.updateElementGeometry.mock.calls
        expect(calls.length).toBe(2)
        const [element, { canvasTransform }] = calls[0]
        expect(element).toBe(a.element)

        const m = canvasTransform.values
        expectPoint(apply(m, 0, 0), drawn(planeA, camera, -150, 100))
        expectPoint(apply(m, 300, 200), drawn(planeA, camera, 150, -100))
        expectPoint(apply(m, 40, 150), drawn(planeA, camera, -110, -50))

        /**
         * Nothing moved, nothing to update.
         */
        canvas.updateElementGeometry.mockClear()
        await nextFrame()
        expect(canvas.updateElementGeometry).not.toHaveBeenCalled()

        planeA.dispose()
        planeB.dispose()
    })

    it("clears geometry when a plane isn't drawn", async () => {
        const { canvas, camera, scene, a, planeA, planeB } = setup()
        paint(canvas)
        await nextFrame()

        const cleared = () =>
            canvas.clearElementGeometry.mock.calls.filter(
                ([element]: [Element]) => element === a.element
            ).length
        const placed = () =>
            canvas.updateElementGeometry.mock.calls.filter(
                ([element]: [Element]) => element === a.element
            ).length

        // Behind the camera
        planeA.position.z = camera.position.z + 100
        await nextFrame()
        expect(cleared()).toBe(1)

        planeA.position.z = 0
        await nextFrame()
        expect(placed()).toBe(2)

        // Hidden
        planeA.visible = false
        await nextFrame()
        expect(cleared()).toBe(2)
        planeA.visible = true
        await nextFrame()
        expect(placed()).toBe(3)

        // Turned away, with a front side material
        planeA.rotation.y = Math.PI
        await nextFrame()
        expect(cleared()).toBe(3)

        // Turned away, with a double sided material: placed mirrored
        planeA.material.side = THREE.DoubleSide
        await nextFrame()
        expect(placed()).toBe(4)

        // Removed from the scene
        scene.remove(planeA)
        await nextFrame()
        expect(cleared()).toBe(4)

        planeA.dispose()
        planeB.dispose()
    })

    it("refits the geometry and texture when the element resizes", () => {
        const { canvas, gl, a, planeA, planeB } = setup()
        paint(canvas)

        setSize(a.element, 400, 100)
        gl.texImage2D.mockClear()
        paint(canvas, [a.element])

        expect(planeA.geometry.parameters).toMatchObject({
            width: 400,
            height: 100,
        })
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D,
            0,
            gl.SRGB8_ALPHA8,
            800,
            200,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        )

        planeA.dispose()
        planeB.dispose()
    })

    it("sizes planes in world units with pixelSize", () => {
        const { renderer } = createRenderer()
        const { element } = createElement()
        const plane = htmlPlane(element, {
            three: THREE,
            renderer,
            camera: createCamera(),
            pixelSize: 0.01,
        })

        expect(plane.geometry.parameters.width).toBeCloseTo(3)
        expect(plane.geometry.parameters.height).toBeCloseTo(2)
        plane.dispose()
    })

    it("uses custom geometry and materials", () => {
        const { canvas, renderer } = createRenderer()
        const { element } = createElement()
        const geometry = jest.fn(
            (width: number, height: number) =>
                new THREE.PlaneGeometry(width, height, 32, 1)
        )
        let map: any
        const plane = htmlPlane(element, {
            three: { Mesh: THREE.Mesh, ExternalTexture: THREE.ExternalTexture },
            renderer,
            camera: createCamera(),
            geometry,
            material: (texture) => {
                map = texture
                return new THREE.ShaderMaterial({
                    uniforms: { map: { value: texture } },
                })
            },
        })

        expect(geometry).toHaveBeenCalledWith(300, 200)
        expect(map).toBe(plane.texture)
        expect(plane.material.uniforms.map.value).toBe(plane.texture)

        setSize(element, 320, 200)
        paint(canvas)
        expect(geometry).toHaveBeenLastCalledWith(320, 200)
        expect(plane.geometry.parameters.widthSegments).toBe(32)

        plane.dispose()
    })

    it("tolerates elements that can't be drawn", () => {
        const { canvas, gl, renderer } = createRenderer()
        const { element } = createElement()
        const plane = htmlPlane(element, {
            three: THREE,
            renderer,
            camera: createCamera(),
        })

        gl.texElementSubImage2D.mockImplementation(() => {
            throw new Error("No snapshot")
        })
        expect(() => paint(canvas)).not.toThrow()
        plane.dispose()
    })

    it("puts the element back and stops on dispose", async () => {
        const { canvas, gl, scene, a, b, planeA, planeB } = setup()
        paint(canvas)
        await nextFrame()

        planeA.dispose()
        expect(a.element.parentNode).toBe(a.home)
        expect(a.element.hasAttribute("drawable")).toBe(false)
        expect(canvas.clearElementGeometry).toHaveBeenCalledWith(a.element)
        expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
        expect(planeA.parent).toBe(null)
        expect(scene.children).toEqual([planeB])

        planeB.dispose()
        expect(b.element.parentNode).toBe(b.home)

        canvas.updateElementGeometry.mockClear()
        gl.texElementSubImage2D.mockClear()
        paint(canvas)
        planeB.rotation.y = 0.5
        await nextFrame()
        expect(gl.texElementSubImage2D).not.toHaveBeenCalled()
        expect(canvas.updateElementGeometry).not.toHaveBeenCalled()
    })
})
