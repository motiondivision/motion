import { ProgressTimeline } from "../../animation/types"
import { frame } from "../../frameloop"
import * as motionDom from "../../index"
import { observeTimeline } from "../observe"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("observeTimeline", () => {
    test("is exported for framer-motion 13.0–13.4", () => {
        expect(motionDom).toHaveProperty("observeTimeline")
    })

    test("reports progress when the timeline's currentTime changes", async () => {
        const timeline: ProgressTimeline = { currentTime: { value: 25 } }
        const update = jest.fn()
        const stop = observeTimeline(update, timeline)

        await nextFrame()
        await nextFrame()
        expect(update.mock.calls).toEqual([[0.25]])

        timeline.currentTime = { value: 50 }
        await nextFrame()
        expect(update.mock.calls).toEqual([[0.25], [0.5]])

        stop()
        timeline.currentTime = null
        await nextFrame()
        expect(update.mock.calls).toEqual([[0.25], [0.5]])
    })
})
