import { animate, cancelFrame, frame as motionFrame, motionValue } from "motion"
import { vgpuEffect } from "motion/vgpu"
import { effect, frame as vgpuFrame, init, surface, uniforms } from "vgpu"
import "./gpu-adapters.css"

animate.addEffect(vgpuEffect)

const stage = document.querySelector(".stage")
const canvas = document.querySelector("canvas")
const intensityInput = document.querySelector("#intensity")
const status = document.querySelector("#status")

const tints = ["#0cc2e0", "#fbbf24"]

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

            struct Params {
                tint: vec3f,
                mouse: vec2f,
            }

            @group(0) @binding(0)
            var<uniform> globals: Globals;

            @group(0) @binding(1)
            var<uniform> params: Params;

            @fragment
            fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
                let distance = length(uv - params.mouse);
                let wave = 0.5 + 0.5 * cos(
                    distance * 24.0 - globals.progress * 12.0
                );
                let purple = vec3f(0.32, 0.12, 0.72);
                let glow = smoothstep(0.35, 0.0, distance) * 0.35;
                let color = (mix(purple, params.tint, wave) + glow) * globals.intensity;

                return vec4f(color, 1.0);
            }
        `,
        { set: { globals } }
    )

    /**
     * Effects have no getters, so the first animation of a binding needs
     * explicit keyframes. This one also writes the initial values before the
     * first frame renders, so `params` never needs a vgpu-side set().
     */
    animate(
        gradient,
        {
            "params.tint": [tints[0], tints[0]],
            "params.mouse": ["0.5 0.5", "0.5 0.5"],
        },
        { duration: 0 }
    )

    const intensity = motionValue(1)
    const cancelUniformEffect = vgpuEffect(globals, { intensity })

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

    let tintIndex = 0
    document.querySelector("#tint").addEventListener("click", () => {
        tintIndex = (tintIndex + 1) % tints.length
        status.textContent = "Animating params.tint as a CSS color"

        animate(
            gradient,
            { "params.tint": tints[tintIndex] },
            { duration: 1, ease: "easeInOut" }
        ).then(() => {
            status.textContent = `tint ${tints[tintIndex]}`
        })
    })

    canvas.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect()

        animate(
            gradient,
            {
                "params.mouseX": (event.clientX - rect.left) / rect.width,
                "params.mouseY": (event.clientY - rect.top) / rect.height,
            },
            { type: "spring", stiffness: 120, damping: 20 }
        )
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
