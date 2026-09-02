import { animate, cancelFrame, frame } from "motion"
import { threeEffect } from "motion/three"
import * as THREE from "three"
import "./gpu-adapters.css"

animate.addEffect(threeEffect)

const canvas = document.querySelector("canvas")
const status = document.querySelector("#status")
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)

renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor("#09090b")
camera.position.set(0, 0, 7)

scene.add(new THREE.HemisphereLight("#c4b5fd", "#111827", 3))

const meshMaterial = new THREE.MeshStandardMaterial({
    color: "#8b5cf6",
    metalness: 0.25,
    roughness: 0.2,
    transparent: true,
})
const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), meshMaterial)
mesh.position.x = -1.5
scene.add(mesh)

const uniforms = {
    progress: { value: 0 },
    tint: { value: new THREE.Color("#22d3ee") },
}
const shaderMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform float progress;
        uniform vec3 tint;

        void main() {
            float edge = smoothstep(progress - 0.18, progress + 0.18, vUv.x);
            vec3 color = mix(tint, vec3(0.12, 0.05, 0.32), edge);
            gl_FragColor = vec4(color, 1.0);
        }
    `,
})
const uniformMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8, 24, 24),
    shaderMaterial
)
uniformMesh.position.x = 1.45
scene.add(uniformMesh)

let meshActive = false
let uniformActive = false

document.querySelector("#move").addEventListener("click", () => {
    meshActive = !meshActive
    status.textContent = "Animating object and material properties"

    animate(
        mesh,
        meshActive
            ? {
                  x: -0.8,
                  rotateX: 35,
                  rotateY: 180,
                  scale: 1.25,
                  color: "#f43f5e",
                  opacity: 0.65,
              }
            : {
                  x: -1.5,
                  rotateX: 0,
                  rotateY: 0,
                  scale: 1,
                  color: "#8b5cf6",
                  opacity: 1,
              },
        { type: "spring", visualDuration: 0.7, bounce: 0.25 }
    ).then(() => {
        status.textContent = "Object animation complete"
    })
})

document.querySelector("#uniform").addEventListener("click", () => {
    uniformActive = !uniformActive
    status.textContent = "Animating shader uniforms"

    animate(
        uniforms,
        {
            progress: uniformActive ? 1 : 0,
            tint: uniformActive ? "#fbbf24" : "#22d3ee",
        },
        { duration: 1, ease: "easeInOut" }
    ).then(() => {
        status.textContent = "Uniform animation complete"
    })
})

document.querySelector("#reset").addEventListener("click", () => {
    meshActive = true
    uniformActive = true
    document.querySelector("#move").click()
    document.querySelector("#uniform").click()
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
    mesh.geometry.dispose()
    uniformMesh.geometry.dispose()
    meshMaterial.dispose()
    shaderMaterial.dispose()
    renderer.dispose()
})
