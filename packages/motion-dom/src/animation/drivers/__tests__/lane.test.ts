import { frame } from "../../../frameloop"
import { JSAnimation } from "../../JSAnimation"
import { frameloopDriver } from "../frame"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const frames = async (n: number) => {
    for (let i = 0; i < n; i++) await nextFrame()
}

const linear = (latest: number[]) =>
    new JSAnimation<number>({
        keyframes: [0, 1000],
        duration: 10000,
        ease: "linear",
        onUpdate: (v) => latest.push(v),
    })

describe("JS animations blended by the frame driver", () => {
    it("keeps value and time in step", async () => {
        const latest: number[] = []
        const animation = linear(latest)

        await frames(5)

        // The driver runs the blend itself.
        expect((animation as any).driver.lane).toBeDefined()

        const value = latest[latest.length - 1]
        expect(value).toBeGreaterThan(0)
        expect(value).toBeCloseTo(animation.time * 100, 5)
        for (let i = 1; i < latest.length; i++) {
            expect(latest[i]).toBeGreaterThanOrEqual(latest[i - 1])
        }
        animation.stop()
    })

    it("stops changing once paused", async () => {
        const latest: number[] = []
        const animation = linear(latest)

        await frames(4)
        animation.pause()
        await frames(1)
        const held = latest[latest.length - 1]
        const count = latest.length
        await frames(3)

        expect(latest.length).toBe(count)
        expect(held).toBeCloseTo(animation.time * 100, 5)
        animation.stop()
    })

    it("follows a seek and keeps running from it", async () => {
        const latest: number[] = []
        const animation = linear(latest)

        await frames(4)
        animation.time = 5
        await frames(1)
        expect(latest[latest.length - 1]).toBeGreaterThanOrEqual(500)
        expect(latest[latest.length - 1]).toBeLessThan(510)

        await frames(3)
        expect(latest[latest.length - 1]).toBeGreaterThan(500)
        expect(latest[latest.length - 1]).toBeCloseTo(animation.time * 100, 5)
        animation.stop()
    })

    it("follows a change of speed", async () => {
        const latest: number[] = []
        const animation = linear(latest)

        await frames(4)
        animation.speed = -1
        await frames(4)

        const n = latest.length
        expect(latest[n - 1]).toBeLessThan(latest[n - 2])
        expect(latest[n - 1]).toBeCloseTo(animation.time * 100, 5)
        animation.stop()
    })

    it("stops writing once stopped", async () => {
        const latest: number[] = []
        const animation = linear(latest)

        await frames(4)
        animation.stop()
        const count = latest.length
        await frames(3)

        expect(latest.length).toBe(count)
    })

    it("updates a driver stopped and restarted in one frame once a frame", async () => {
        const update = jest.fn()
        const driver = frameloopDriver(update)

        driver.start()
        await nextFrame()
        driver.stop()
        driver.start()
        await frames(2)

        expect(update).toHaveBeenCalledTimes(3)
        driver.stop()
    })
})
