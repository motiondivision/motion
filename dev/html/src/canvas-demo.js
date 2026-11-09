import { animate, canvasLayer, drag, renderVideo } from "./canvas-inc.js"
import { createVideoSink } from "./canvas-video-sink.js"

const canvas = document.querySelector("canvas")
const status = document.querySelector("#status")
const blur = document.querySelector("#blur")
const layer = canvasLayer(canvas, { motionBlur: +blur.value })

/**
 * A noisy wipe: the element dissolves left to right as progress goes 0-1,
 * with a glowing edge in `glow`.
 */
const dissolve = `
uniform float progress;
uniform vec3 glow;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec4 effect(vec2 uv) {
    vec4 color = texture(uTexture, uv);
    float edge = uv.x + (hash(floor(uv * uSize / 6.0)) - 0.5) * 0.2 - progress * 1.3 + 0.15;
    float keep = smoothstep(0.0, 0.02, edge);
    float rim = exp(-edge * edge * 900.0) * step(0.001, progress);
    return vec4(color.rgb * keep + glow * rim * color.a, color.a * max(keep, rim));
}`

const slots = []
for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 3; column++) {
        slots.push({ x: 24 + column * 232, y: 40 + row * 192 })
    }
}

if (!layer.supported) {
    document.querySelector(".unsupported").classList.add("on")
} else {
    const names = [
        "Layout",
        "Scroll",
        "Spring",
        "Gesture",
        "Presence",
        "Timeline",
    ]
    const tiles = names.map((name, i) => {
        const tile = document.createElement("div")
        tile.className = "tile"
        tile.innerHTML = `<span>${name}</span><button>Toggle</button>`
        tile.querySelector("button").onclick = () => tile.classList.toggle("on")
        layer.add(tile, {
            ...slots[i],
            shader: dissolve,
            uniforms: { progress: 0, glow: "#facc15" },
        })
        drag(tile)
        return tile
    })

    let order = tiles.map((_, i) => i)
    const shuffle = () => {
        order = [...order.slice(1), order[0]]
        tiles.forEach((tile, i) =>
            animate(
                tile,
                { ...slots[order[i]], rotate: 0, progress: 0 },
                {
                    type: "spring",
                    visualDuration: 0.4,
                    bounce: 0.2,
                    delay: i * 0.03,
                }
            )
        )
    }

    document.querySelector("#shuffle").onclick = shuffle
    blur.oninput = () => (layer.motionBlur = +blur.value)
    document.querySelector("#wipe").onclick = () =>
        tiles.forEach((tile, i) =>
            animate(
                tile,
                { progress: [0, 1, 0] },
                { duration: 1.6, delay: i * 0.08 }
            )
        )

    document.querySelector("#export").onclick = async () => {
        const fps = 60
        const timeline = animate(
            tiles.flatMap((tile, i) => [
                [
                    tile,
                    { rotate: 360, x: slots[5 - i].x, y: slots[5 - i].y },
                    {
                        type: "spring",
                        visualDuration: 0.6,
                        bounce: 0.3,
                        at: i * 0.1,
                    },
                ],
                [
                    tile,
                    { progress: [0, 1, 0] },
                    { duration: 1, at: 1.5 + i * 0.1 },
                ],
            ])
        )
        status.textContent = "Rendering"
        const sink = await createVideoSink(canvas, { fps })
        const frames = await renderVideo(layer, timeline, {
            fps,
            duration: 3,
            onFrame: sink.onFrame,
        })
        const video = await sink.finalize()
        const link = document.createElement("a")
        link.href = URL.createObjectURL(video)
        link.download = `motion-canvas.${sink.codec === "avc" ? "mp4" : "webm"}`
        link.textContent = `Download ${frames} frames (${sink.codec}, ${(
            video.size / 1e6
        ).toFixed(2)} MB)`
        status.replaceChildren(link)
    }
}
