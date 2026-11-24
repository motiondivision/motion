import { frame, motionValue } from "motion-dom"
import { animate } from ".."

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await nextFrame()
}

/**
 * A value waiting out its delay holds its first keyframe. Once it's set
 * there, the frames of the delay don't set it again.
 */
describe("values in their delay", () => {
    test("aren't set again on every frame of the delay", async () => {
        const x = motionValue(0)
        const set = jest.spyOn(x, "set")
        animate(x, [0, 100], { delay: 0.5, duration: 0.1, ease: "linear" })
        await frames(5)

        expect(set.mock.calls.length).toBeLessThanOrEqual(1)
        expect(x.get()).toBe(0)
    })

    test("still start moving when the delay ends", async () => {
        const x = motionValue(0)
        await animate(x, [0, 100], { delay: 0.05, duration: 0.05 })
        expect(x.get()).toBe(100)
    })

    test("still call a transition's onUpdate on every frame", async () => {
        const x = motionValue(0)
        const onUpdate = jest.fn()
        animate(x, [0, 100], { delay: 0.5, duration: 0.1, onUpdate })
        await frames(5)

        expect(onUpdate.mock.calls.length).toBeGreaterThan(2)
    })

    test("go back to their first keyframe after an outside write", async () => {
        const x = motionValue(0)
        animate(x, [0, 100], { delay: 0.5, duration: 0.1 })
        await frames(2)
        x.set(50)
        await frames(2)

        expect(x.get()).toBe(0)
    })
})
