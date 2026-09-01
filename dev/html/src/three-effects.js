import { cancelFrame, frame, motionValue, transformValue } from "motion"
import { animate, objectEffect, uniformEffect } from "motion/three"
import * as THREE from "three"
import "./gpu-adapters.css"

const canvas = document.querySelector("canvas")
const positionInput = document.querySelector("#position")
const progressInput = document.querySelector("#progress")
const status = document.querySelector("#status")
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)

renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor("#09090b")
camera.position.z = 6

const uniforms = {
    progress: { value: 0 },
}
const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
        uniform float progress;
        varying vec3 vNormal;

        void main() {
            vNormal = normal;
            float wave = sin((position.y + progress) * 8.0) * progress * 0.12;
            vec3 transformed = position + normal * wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
    `,
    fragmentShader: `
        uniform float progress;
        varying vec3 vNormal;

        void main() {
            vec3 purple = vec3(0.49, 0.23, 0.93);
            vec3 cyan = vec3(0.13, 0.83, 0.93);
            float light = dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 1.0)));
            vec3 color = mix(purple, cyan, progress) * (0.7 + light * 0.4);
            gl_FragColor = vec4(color, 1.0);
        }
    `,
})
const mesh = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.9, 0.28, 160, 24),
    material
)
scene.add(mesh)

const x = motionValue(0)
const rotateY = motionValue(0)
const progress = motionValue(0)
const scale = transformValue(() => 0.9 + progress.get() * 0.3)

const cancelObjectEffect = objectEffect(mesh, { x, rotateY, scale })
const cancelUniformEffect = uniformEffect(uniforms, { progress })

function updateStatus() {
    status.textContent = `x ${x.get().toFixed(2)} · progress ${progress
        .get()
        .toFixed(2)}`
}

const cancelXStatus = x.on("change", (latest) => {
    positionInput.value = latest
    updateStatus()
})
const cancelProgressStatus = progress.on("change", (latest) => {
    progressInput.value = latest
    updateStatus()
})

positionInput.addEventListener("input", () => {
    x.set(Number(positionInput.value))
})

progressInput.addEventListener("input", () => {
    progress.set(Number(progressInput.value))
})

let active = false
document.querySelector("#spring").addEventListener("click", () => {
    active = !active

    animate(
        mesh,
        {
            x: active ? 1.4 : -1.4,
            rotateY: active ? 220 : 0,
        },
        { type: "spring", stiffness: 180, damping: 18 }
    )

    animate(
        uniforms,
        { progress: active ? 1 : 0 },
        { type: "spring", stiffness: 140, damping: 16 }
    )
})

function resize() {
    const { clientWidth, clientHeight } = canvas
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
}

function render() {
    renderer.render(scene, camera)
}

resize()
new ResizeObserver(resize).observe(canvas)
frame.render(render, true)

window.addEventListener("pagehide", () => {
    cancelFrame(render)
    cancelXStatus()
    cancelProgressStatus()
    cancelObjectEffect()
    cancelUniformEffect()
    mesh.geometry.dispose()
    material.dispose()
    renderer.dispose()
})
