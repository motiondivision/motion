import { motion } from "framer-motion"

/**
 * Independent transforms never animate from a stylesheet transform, so an
 * element with one must never paint it, even for the frame before its first
 * animation frame.
 *
 * ResizeObserver callbacks run after every requestAnimationFrame callback and
 * layout, just before paint, so resizing a probe each frame samples exactly
 * what gets painted.
 *
 * The commit is held past a frame so the browser paints before React runs
 * passive effects (and so starts animations), as it does whenever the initial
 * render runs long.
 */
function sampleFrames(box: HTMLElement | null) {
    if (!box) return

    const samples: string[] = []
    const probe = document.createElement("div")
    document.body.appendChild(probe)

    new ResizeObserver(() => {
        samples.push(getComputedStyle(box).transform)
        box.dataset.samples = JSON.stringify(samples)
    }).observe(probe)

    let count = 0
    const resize = () => {
        probe.style.width = `${++count % 2}px`
        if (count < 10) requestAnimationFrame(resize)
    }
    requestAnimationFrame(resize)

    const start = performance.now()
    while (performance.now() - start < 50) {}
}

export const App = () => (
    <>
        <style>{`#box { transform: translateX(100px); }`}</style>
        <motion.div
            id="box"
            ref={sampleFrames}
            animate={{ x: 200 }}
            transition={{ duration: 10, ease: "linear" }}
            style={{ width: 100, height: 100, background: "red" }}
        />
    </>
)
