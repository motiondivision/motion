import type { LayoutPlaneSource } from "framer-motion/dom"
import { layoutPlane } from "../three"

/**
 * The package's own `three` entry shadows the library for type resolution
 * here, so name the library's types by path.
 */
const THREE: typeof import("three/src/Three.js") = require("three")
type Mesh = import("three/src/Three.js").Mesh
type Camera = import("three/src/Three.js").Camera

/**
 * Newer than the installed three.js types.
 */
const autoUpdates = (mesh: Mesh) =>
    (mesh as unknown as { matrixWorldAutoUpdate: boolean })
        .matrixWorldAutoUpdate

const sources: LayoutPlaneSource[] = []

jest.mock("framer-motion/dom", () => ({
    ...jest.requireActual("framer-motion/dom"),
    createLayoutPlane: (source: LayoutPlaneSource) => {
        sources.push(source)
        return { show() {}, hide() {} }
    },
}))

const canvasRect = { left: 10, top: 20, width: 800, height: 600 }
const canvas = {
    getBoundingClientRect: () => canvasRect,
} as unknown as Element

function createPlane() {
    const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 100)
    camera.position.set(0.5, -0.2, 6)
    camera.lookAt(0, 0, 0)

    const material = new THREE.MeshBasicMaterial({ opacity: 0.8 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.25), material)
    mesh.position.set(1, 0.3, -0.5)
    mesh.rotation.set(-0.3, 0.5, 0.1)

    const scene = new THREE.Scene()
    const group = new THREE.Group()
    group.rotation.z = 0.2
    group.position.y = 0.4
    group.add(mesh)
    scene.add(group, camera)

    layoutPlane(mesh, { layoutId: "card", camera, canvas })
    const source = sources[sources.length - 1]

    return { camera, mesh, material, scene, source }
}

/**
 * Where three.js draws the mesh's corners, through the world matrix it
 * renders with, in viewport pixels.
 */
function drawn(mesh: Mesh, camera: Camera, matrix = mesh.matrixWorld) {
    camera.updateMatrixWorld()
    const out: number[] = []
    for (const [x, y] of [
        [-1, 0.625],
        [1, 0.625],
        [1, -0.625],
        [-1, -0.625],
    ]) {
        const v = new THREE.Vector4(x, y, 0, 1)
            .applyMatrix4(matrix)
            .applyMatrix4(camera.matrixWorldInverse)
            .applyMatrix4(camera.projectionMatrix)
        out.push(
            canvasRect.left + ((v.x / v.w + 1) / 2) * canvasRect.width,
            canvasRect.top + ((1 - v.y / v.w) / 2) * canvasRect.height
        )
    }
    return out
}

function expectCorners(actual: ArrayLike<number>, expected: number[]) {
    for (let i = 0; i < 8; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], 6)
    }
}

const corners = (t: Float64Array) => {
    const out: number[] = []
    for (const [x, y] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ]) {
        const w = t[6] * x + t[7] * y + t[8]
        out.push(
            (t[0] * x + t[1] * y + t[2]) / w,
            (t[3] * x + t[4] * y + t[5]) / w
        )
    }
    return out
}

/**
 * A homography from the unit square onto a turned, foreshortened quad.
 */
const transform = new Float64Array([
    220, 40, 120, -30, 140, 90, 0.0004, -0.0006, 1,
])

describe("layoutPlane", () => {
    it("measures the corners a mesh is laid out at in the viewport", () => {
        const { mesh, camera, source } = createPlane()
        const out = new Float64Array(8)

        mesh.updateWorldMatrix(true, false)
        const expected = drawn(mesh, camera)

        expect(source.measure(out)).toBe(true)
        expectCorners(out, expected)

        out.fill(0)
        expect(source.track(out)).toBe(true)
        expectCorners(out, expected)
    })

    it("tracks a mesh as it moves, without its world matrix", () => {
        const { mesh, camera, source } = createPlane()
        const out = new Float64Array(8)
        source.measure(out)

        source.render(transform, 1, true)
        mesh.position.x -= 0.6
        mesh.rotation.y += 0.4

        const natural = new THREE.Matrix4()
            .compose(mesh.position, mesh.quaternion, mesh.scale)
            .premultiply(mesh.parent!.matrixWorld)

        expect(source.track(out)).toBe(true)
        expectCorners(out, drawn(mesh, camera, natural))
    })

    it("reports a mesh behind the camera as hidden", () => {
        const { mesh, source } = createPlane()
        mesh.position.z = 20
        expect(source.measure(new Float64Array(8))).toBe(false)
    })

    it("draws a mesh wherever it's projected", () => {
        const { mesh, camera, source } = createPlane()
        source.measure(new Float64Array(8))

        source.render(transform, 1, true)

        expect(mesh.visible).toBe(true)
        expect(autoUpdates(mesh)).toBe(false)
        expect(mesh.frustumCulled).toBe(false)
        expectCorners(drawn(mesh, camera), corners(transform))

        /**
         * Every corner is drawn inside the depth range, so it isn't clipped.
         */
        for (const [x, y] of [
            [-1, 0.625],
            [1, -0.625],
        ]) {
            const v = new THREE.Vector4(x, y, 0, 1)
                .applyMatrix4(mesh.matrixWorld)
                .applyMatrix4(camera.matrixWorldInverse)
                .applyMatrix4(camera.projectionMatrix)
            expect(v.w).toBeGreaterThan(0)
            expect(Math.abs(v.z / v.w)).toBeLessThan(1)
        }

        /**
         * A scene update doesn't overwrite it.
         */
        mesh.parent!.parent!.updateMatrixWorld(true)
        expectCorners(drawn(mesh, camera), corners(transform))
    })

    it("restores a mesh once it's drawn where it's laid out", () => {
        const { mesh, camera, scene, source } = createPlane()
        source.measure(new Float64Array(8))

        source.render(transform, 1, true)
        source.render(undefined, 1, true)

        expect(autoUpdates(mesh)).toBe(true)
        expect(mesh.frustumCulled).toBe(true)

        scene.updateMatrixWorld()
        const natural = new THREE.Matrix4()
            .compose(mesh.position, mesh.quaternion, mesh.scale)
            .premultiply(mesh.parent!.matrixWorld)
        expectCorners(drawn(mesh, camera), drawn(mesh, camera, natural))
    })

    it("fades materials and restores them", () => {
        const { mesh, material, source } = createPlane()
        source.measure(new Float64Array(8))

        source.render(transform, 0.5, true)
        expect(material.opacity).toBeCloseTo(0.4)
        expect(material.transparent).toBe(true)

        source.render(transform, 1, true)
        expect(material.opacity).toBe(0.8)
        expect(material.transparent).toBe(false)

        source.render(transform, 0.25, true)
        source.render(undefined, 0, false)
        expect(mesh.visible).toBe(false)
        expect(material.opacity).toBe(0.8)
        expect(material.transparent).toBe(false)
    })
})
