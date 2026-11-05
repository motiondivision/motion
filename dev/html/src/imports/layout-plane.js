import { frame } from "framer-motion/dom"
import { layoutPlane } from "motion/three"
import * as THREE from "three"

/**
 * Helpers for layout plane tests: a three.js scene drawn in frame.render,
 * and where three.js actually draws a mesh.
 */

function createScene(
    canvas,
    { width = 2, height = 1.25, color = "#0088ff" } = {}
) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        preserveDrawingBuffer: true,
        antialias: false,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    renderer.setClearColor("#000000")

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
        50,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        100
    )
    camera.position.set(0, 0, 6)

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    )
    scene.add(mesh)

    frame.render(() => renderer.render(scene, camera), true)

    return { renderer, scene, camera, mesh }
}

function localCorners(mesh) {
    const { geometry } = mesh
    geometry.boundingBox || geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    return [
        [min.x, max.y],
        [max.x, max.y],
        [max.x, min.y],
        [min.x, min.y],
    ]
}

function toViewport(matrix, mesh, camera, canvas) {
    const rect = canvas.getBoundingClientRect()
    const out = []
    for (const [x, y] of localCorners(mesh)) {
        const v = new THREE.Vector4(x, y, 0, 1).applyMatrix4(matrix)
        v.applyMatrix4(camera.matrixWorldInverse)
        v.applyMatrix4(camera.projectionMatrix)
        out.push(
            rect.left + ((v.x / v.w + 1) / 2) * rect.width,
            rect.top + ((1 - v.y / v.w) / 2) * rect.height
        )
    }
    return out
}

/**
 * Where three.js draws the mesh: its corners through the world matrix it
 * renders with.
 */
function drawnCorners(mesh, camera, canvas) {
    camera.updateMatrixWorld()
    mesh.updateMatrixWorld()
    return toViewport(mesh.matrixWorld, mesh, camera, canvas)
}

/**
 * Where the mesh is laid out in the scene, from its position, rotation and
 * scale, whatever world matrix it's drawn with.
 */
function naturalCorners(mesh, camera, canvas) {
    camera.updateMatrixWorld()
    const matrix = new THREE.Matrix4().compose(
        mesh.position,
        mesh.quaternion,
        mesh.scale
    )
    return toViewport(matrix, mesh, camera, canvas)
}

/**
 * The colour drawn at a viewport point, as [r, g, b, a].
 */
function pixel(renderer, canvas, x, y) {
    const rect = canvas.getBoundingClientRect()
    const gl = renderer.getContext()
    const out = new Uint8Array(4)
    gl.readPixels(
        Math.round(x - rect.left),
        Math.round(rect.bottom - y),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        out
    )
    return [...out]
}

window.LayoutPlane = {
    THREE,
    layoutPlane,
    createScene,
    drawnCorners,
    naturalCorners,
    pixel,
}
