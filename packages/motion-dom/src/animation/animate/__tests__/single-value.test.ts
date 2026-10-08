import { frame } from "../../../frameloop"
import { time } from "../../../frameloop/sync-time"
import { motionValue } from "../../../value"
import { JSAnimation } from "../../JSAnimation"
import { animateSingleValue } from "../single-value"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

function busy(ms: number) {
    const end = performance.now() + ms
    while (performance.now() < end) {}
}

describe("animateSingleValue", () => {
    test("starts when called, not at an earlier clock read in the same task", async () => {
        const x = motionValue(0)
        const other = motionValue(0)

        other.set(1)
        busy(100)

        const calledAt = performance.now()
        const animation = animateSingleValue(x, 100, {
            duration: 1,
            ease: "linear",
        })

        await nextFrame()

        // 1 unit of x is 10ms of animation time
        expect(x.get() * 10).toBeLessThanOrEqual(
            performance.now() - calledAt + 1
        )
        animation.stop()
    })
})

describe("JSAnimation", () => {
    test("autoplay: false holds at the first keyframe", () => {
        time.now()
        busy(50)

        const animation = new JSAnimation({
            keyframes: [0, 100],
            duration: 1000,
            autoplay: false,
        })

        expect(animation.time).toBe(0)

        animation.stop()
    })
})
