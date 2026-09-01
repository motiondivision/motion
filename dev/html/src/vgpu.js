import { cancelFrame, frame as motionFrame, motionValue } from "motion"
import { animate, uniformEffect } from "motion/vgpu"
import { effect, frame as vgpuFrame, init, surface, uniforms } from "vgpu"
import "./gpu-adapters.css"

const stage = document.querySelector(".stage")
const canvas = document.querySelector("canvas")
const intensityInput = document.querySelector("#intensity")
const status = document.querySelector("#status")

async function start() {
    if (!navigator.gpu) {
        stage.innerHTML =
            '<div class="error">This example needs a browser with WebGPU enabled.</div>'
        return
    }

    const gpu = await init()
    const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] })
    const globals = uniforms(gpu, {
        progress: 0,
        intensity: 1,
    })
    const gradient = effect(
        gpu,
        `
            struct Globals {
                progress: f32,
                intensity: f32,
            }

            @group(0) @binding(0)
            var<uniform> globals: Globals;

            @fragment
            fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
                let center = vec2f(0.5, 0.5);
                let distance = length(uv - center);
                let wave = 0.5 + 0.5 * cos(
                    distance * 24.0 - globals.progress * 12.0
                );
                let purple = vec3f(0.32, 0.12, 0.72);
                let cyan = vec3f(0.05, 0.76, 0.88);
                let color = mix(purple, cyan, wave) * globals.intensity;

                return vec4f(color, 1.0);
            }
        `,
        { set: { globals } }
    )

    const intensity = motionValue(1)
    const cancelUniformEffect = uniformEffect(globals, { intensity })

    intensityInput.addEventListener("input", () => {
        intensity.set(Number(intensityInput.value))
        status.textContent = `intensity ${intensity.get().toFixed(2)}`
    })

    let active = false
    document.querySelector("#animate").addEventListener("click", () => {
        active = !active
        status.textContent = "Animating unbound progress keyframes"

        animate(
            globals,
            { progress: active ? [0, 1] : [1, 0] },
            { duration: 1.6, ease: "easeInOut" }
        ).then(() => {
            status.textContent = `progress ${active ? "1.00" : "0.00"}`
        })
    })

    function render() {
        vgpuFrame(gpu, (currentFrame) => {
            currentFrame.pass(canvasSurface, gradient)
        })
    }

    motionFrame.render(render, true)

    window.addEventListener("pagehide", () => {
        cancelFrame(render)
        cancelUniformEffect()
        gpu.dispose()
    })
}

start().catch((error) => {
    stage.innerHTML = `<div class="error">${error.message}</div>`
    throw error
})
