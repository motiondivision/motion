import { animate, cancelFrame, frame as motionFrame } from "motion"
import { vgpuEffect } from "motion/vgpu"
import {
    clock,
    draw,
    effect,
    frame as vgpuFrame,
    geometry,
    init,
    sampler,
    surface,
    target,
} from "vgpu"
import {
    box,
    directionalLight,
    mesh,
    orbitControls,
    perspectiveCamera,
    srgb,
    unlitMaterial,
} from "vgpu/scene"
import "./gpu-adapters.css"

animate.addEffect(vgpuEffect)

const stage = document.querySelector(".stage")
const canvas = document.querySelector("canvas")
const status = document.querySelector("#status")

const objectShader = `
    struct Camera { viewProjection: mat4x4f }
    struct Model { model: mat4x4f }
    struct Material { color: vec3f, opacity: f32 }
    struct Light { direction: vec3f, intensity: f32, color: vec3f }

    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var<uniform> model: Model;
    @group(0) @binding(2) var<uniform> material: Material;
    @group(0) @binding(3) var<uniform> light: Light;

    struct VertexOut {
        @builtin(position) position: vec4f,
        @location(0) normal: vec3f,
    }

    @vertex
    fn vs_main(
        @location(0) position: vec3f,
        @location(1) normal: vec3f
    ) -> VertexOut {
        var out: VertexOut;
        out.position = camera.viewProjection * model.model * vec4f(position, 1.0);
        out.normal = (model.model * vec4f(normal, 0.0)).xyz;
        return out;
    }

    @fragment
    fn fs_main(@location(0) normal: vec3f) -> @location(0) vec4f {
        let n = normalize(normal);
        let l = normalize(-light.direction);
        let diffuse = max(dot(n, l), 0.0) * light.intensity * light.color;
        let shade = material.color * (vec3f(0.12) + diffuse);
        return vec4f(shade * material.opacity, material.opacity);
    }
`

const presentShader = `
    @group(0) @binding(0) var scene: texture_2d<f32>;
    @group(0) @binding(1) var sceneSampler: sampler;

    // Material colors are linear (srgb() / animate()), so encode for the canvas.
    @fragment
    fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
        let color = textureSampleLevel(scene, sceneSampler, uv, 0.0);
        return vec4f(pow(color.rgb, vec3f(1.0 / 2.2)), color.a);
    }
`

async function start() {
    if (!navigator.gpu) {
        stage.innerHTML =
            '<div class="error">This example needs a browser with WebGPU enabled.</div>'
        return
    }

    const gpu = await init()
    const time = clock(gpu)
    const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] })
    const sceneTarget = target(gpu, { size: canvasSurface.size, depth: true })

    const material = unlitMaterial({ color: srgb("#8b5cf6") })
    const cube = mesh(box({ size: 1.4 }), material, { position: [-1, 0, 0] })
    const light = directionalLight({
        direction: [-1, -2, -1],
        intensity: 1.2,
    })
    const camera = perspectiveCamera({
        fov: 42,
        aspect: canvasSurface.size[0] / canvasSurface.size[1],
        position: [2.5, 2, 5],
        target: [0, 0, 0],
    })
    const controls = orbitControls(camera, { element: canvas, damping: 0.1 })

    const cubeDraw = draw(gpu, {
        shader: objectShader,
        geometry: geometry(gpu, box({ size: 1 })),
        cull: "back",
        blend: "premultiplied",
    })
    const present = effect(gpu, presentShader, {
        set: {
            scene: sceneTarget,
            sceneSampler: sampler(gpu, {
                minFilter: "linear",
                magFilter: "linear",
            }),
        },
    })

    canvasSurface.onResize(({ width, height }) => {
        sceneTarget.resize([width, height])
        camera.set({ aspect: width / height })
    })

    let meshActive = false
    document.querySelector("#move").addEventListener("click", () => {
        meshActive = !meshActive
        status.textContent = "Animating node transform and material"

        const transition = { type: "spring", visualDuration: 0.7, bounce: 0.25 }

        Promise.all([
            animate(
                cube,
                meshActive
                    ? { x: -0.3, rotateX: 35, rotateY: 180, scale: 1.25 }
                    : { x: -1, rotateX: 0, rotateY: 0, scale: 1 },
                transition
            ),
            animate(
                material,
                meshActive
                    ? { color: "#f43f5e", opacity: 0.65 }
                    : { color: "#8b5cf6", opacity: 1 },
                transition
            ),
        ]).then(() => {
            status.textContent = "Node animation complete"
        })
    })

    let lightActive = false
    document.querySelector("#light").addEventListener("click", () => {
        lightActive = !lightActive
        status.textContent = "Animating light direction, color and intensity"

        animate(
            light,
            lightActive
                ? {
                      directionX: 1,
                      directionZ: 1,
                      intensity: 2,
                      color: "#ffd27a",
                  }
                : {
                      directionX: -1,
                      directionZ: -1,
                      intensity: 1.2,
                      color: "#ffffff",
                  },
            { duration: 1.2, ease: "easeInOut" }
        ).then(() => {
            status.textContent = "Light animation complete"
        })
    })

    let cameraActive = false
    document.querySelector("#camera").addEventListener("click", () => {
        cameraActive = !cameraActive
        status.textContent = "Animating orbit controls and fov"

        Promise.all([
            animate(
                controls,
                cameraActive
                    ? { yaw: controls.yaw + Math.PI, pitch: 0.9, distance: 9 }
                    : { yaw: controls.yaw - Math.PI, pitch: 0.4, distance: 6 },
                { duration: 1.4, ease: "easeInOut" }
            ),
            animate(camera, { fov: cameraActive ? 70 : 42 }, { duration: 1.4 }),
        ]).then(() => {
            status.textContent = "Camera animation complete"
        })
    })

    function update({ delta }) {
        // Motion owns the timeline, so it drives vgpu's clock (see vgpu's
        // "External ticker" guide) and the orbit controls damping.
        time.advance(Math.max(0, delta) / 1000)
        controls.update(time.deltaTime)
    }

    function render() {
        cubeDraw.set({
            camera: { viewProjection: camera.viewProjection },
            model: { model: cube.worldMatrix },
            material: { color: material.color, opacity: material.opacity },
            light: {
                direction: light.direction,
                intensity: light.intensity,
                color: light.color,
            },
        })

        vgpuFrame(gpu, (currentFrame) => {
            currentFrame.pass(
                { target: sceneTarget, clear: [0.003, 0.003, 0.0035, 1] },
                (pass) => pass.draw(cubeDraw)
            )
            currentFrame.pass(canvasSurface, present)
        })
    }

    motionFrame.update(update, true)
    motionFrame.render(render, true)

    window.addEventListener("pagehide", () => {
        cancelFrame(update)
        cancelFrame(render)
        controls.dispose()
        gpu.dispose()
    })
}

start().catch((error) => {
    stage.innerHTML = `<div class="error">${error.message}</div>`
    throw error
})
