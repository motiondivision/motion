import { animate, frame } from "motion"
import { htmlPlane } from "motion/three"
import * as THREE from "three"
import { installHTMLInCanvasTrial } from "./html-in-canvas-trial.js"

/**
 * Helpers for htmlPlane tests. The trial shim installs first, so htmlPlane
 * sees the shipped API in a Chromium build with the origin trial flag.
 */
const support = installHTMLInCanvasTrial()

/**
 * A scene where one world unit is one CSS pixel at z = 0, drawn in
 * frame.render.
 */
function createScene(canvas) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const renderer = new THREE.WebGLRenderer({
        canvas,
        preserveDrawingBuffer: true,
        antialias: false,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.setClearColor("#000000", 1)

    const fov = 30
    const camera = new THREE.PerspectiveCamera(fov, width / height, 10, 10000)
    camera.position.z = height / 2 / Math.tan((fov * Math.PI) / 360)

    const scene = new THREE.Scene()
    const draw = () => renderer.render(scene, camera)
    frame.render(draw, true)

    return { renderer, camera, scene, draw }
}

/**
 * Where three.js draws a point of a plane's element, given in CSS pixels
 * from the element's top-left, in viewport pixels.
 */
function project(plane, camera, x, y) {
    const { canvas } = plane.userData
    const { width, height } = plane.geometry.parameters
    const rect = canvas.getBoundingClientRect()
    plane.updateWorldMatrix(true, false)
    const p = new THREE.Vector3(
        (x / plane.element.offsetWidth - 0.5) * width,
        (0.5 - y / plane.element.offsetHeight) * height,
        0
    )
        .applyMatrix4(plane.matrixWorld)
        .project(camera)

    return [
        rect.left + ((p.x + 1) / 2) * rect.width,
        rect.top + ((1 - p.y) / 2) * rect.height,
    ]
}

/**
 * The colour drawn at a point in the viewport.
 */
function pixel(renderer, x, y) {
    const canvas = renderer.domElement
    const rect = canvas.getBoundingClientRect()
    const gl = renderer.getContext()
    const out = new Uint8Array(4)
    gl.readPixels(
        Math.floor(x - rect.left),
        canvas.height - 1 - Math.floor(y - rect.top),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        out
    )
    return [...out]
}

const nextFrame = () => new Promise((resolve) => frame.postRender(resolve))

window.HTMLPlaneTest = {
    animate,
    frame,
    htmlPlane,
    THREE,
    support,
    createScene,
    project,
    pixel,
    nextFrame,
}
