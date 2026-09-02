import { animate, cancelFrame, frame, motionValue } from "motion"
import { threeEffect } from "motion/three"
import * as THREE from "three"
import { color, mix, positionLocal, sin, uniform, uv, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, WebGPURenderer } from "three/webgpu"
import "./gpu-adapters.css"

const stage = document.querySelector(".stage")
const canvas = document.querySelector("canvas")
const status = document.querySelector("#status")

animate.addEffect(threeEffect)

async function start() {
    const renderer = new WebGPURenderer({ canvas, antialias: true })
    await renderer.init()

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)

    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor("#09090b")
    camera.position.set(0, 0, 7)

    scene.add(new THREE.HemisphereLight("#c4b5fd", "#111827", 3))

    /**
     * Node material mesh: colorNode and opacityNode are TSL uniform nodes.
     * animate(mesh, { color, opacity }) resolves and drives them directly,
     * alongside object transforms, without touching the node graph.
     */
    const meshMaterial = new MeshStandardNodeMaterial({
        metalness: 0.25,
        roughness: 0.2,
        transparent: true,
    })
    meshMaterial.colorNode = uniform(new THREE.Color("#8b5cf6"))
    meshMaterial.opacityNode = uniform(1)

    const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 2),
        meshMaterial
    )
    mesh.position.x = -1.5
    scene.add(mesh)

    /**
     * GPU fan-out: a single progress uniform drives colour and vertex
     * displacement across the whole plane in-shader. A motion value wraps
     * the uniform node via threeEffect; TSL amplifies it per vertex/fragment.
     */
    const progress = uniform(0)
    const progressValue = motionValue(0)
    threeEffect(progress, { value: progressValue })
    const fanoutMaterial = new MeshBasicNodeMaterial()
    const wave = sin(uv().x.mul(9).add(progress.mul(6)))
    fanoutMaterial.colorNode = mix(
        color("#22d3ee"),
        color("#fbbf24"),
        wave.mul(0.5).add(0.5).mul(progress)
    )
    fanoutMaterial.positionNode = positionLocal.add(
        vec3(0, 0, wave.mul(progress).mul(0.25))
    )

    const fanoutMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.8, 32, 32),
        fanoutMaterial
    )
    fanoutMesh.position.x = 1.45
    scene.add(fanoutMesh)

    let meshActive = false
    let fanoutActive = false

    document.querySelector("#mesh").addEventListener("click", () => {
        meshActive = !meshActive
        status.textContent = "Animating transforms and node material uniforms"

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
            status.textContent = "Node material animation complete"
        })
    })

    document.querySelector("#fanout").addEventListener("click", () => {
        fanoutActive = !fanoutActive
        status.textContent = "Springing progress uniform node"

        animate(progressValue, fanoutActive ? 1 : 0, {
            type: "spring",
            visualDuration: 0.8,
            bounce: 0.4,
        }).then(() => {
            status.textContent = `progress ${progress.value.toFixed(2)}`
        })
    })

    document.querySelector("#reset").addEventListener("click", () => {
        meshActive = true
        fanoutActive = true
        document.querySelector("#mesh").click()
        document.querySelector("#fanout").click()
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

    status.textContent = renderer.backend.isWebGPUBackend
        ? "Ready (WebGPU)"
        : "Ready (WebGL fallback)"

    window.addEventListener("pagehide", () => {
        cancelFrame(render)
        mesh.geometry.dispose()
        fanoutMesh.geometry.dispose()
        meshMaterial.dispose()
        fanoutMaterial.dispose()
        renderer.dispose()
    })
}

start().catch((error) => {
    stage.innerHTML = `<div class="error">${error.message}</div>`
    throw error
})
