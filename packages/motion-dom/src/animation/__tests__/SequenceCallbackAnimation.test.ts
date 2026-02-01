import { SequenceCallbackAnimation } from "../SequenceCallbackAnimation"

describe("SequenceCallbackAnimation", () => {
    test("Fires onEnter when time crosses callback point forward", () => {
        const onEnter = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 0.5, onEnter }],
            1000 // 1 second total duration
        )

        animation.time = 0
        expect(onEnter).not.toHaveBeenCalled()

        animation.time = 0.6 // Cross the 0.5s mark
        expect(onEnter).toHaveBeenCalledTimes(1)

        // Setting time again beyond the point shouldn't fire again
        animation.time = 0.8
        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    test("Fires onLeave when time crosses callback point backward", () => {
        const onEnter = jest.fn()
        const onLeave = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 0.5, onEnter, onLeave }],
            1000
        )

        // Start past the callback point
        animation.time = 0.8
        expect(onEnter).toHaveBeenCalledTimes(1)

        // Go backward past the callback point
        animation.time = 0.3
        expect(onLeave).toHaveBeenCalledTimes(1)
    })

    test("Fires multiple callbacks in order when crossing", () => {
        const calls: string[] = []
        const animation = new SequenceCallbackAnimation(
            [
                { time: 0.2, onEnter: () => calls.push("a") },
                { time: 0.5, onEnter: () => calls.push("b") },
                { time: 0.8, onEnter: () => calls.push("c") },
            ],
            1000
        )

        animation.time = 0
        animation.time = 1 // Cross all three

        expect(calls).toEqual(["a", "b", "c"])
    })

    test("Fires callbacks in reverse order when scrubbing backward", () => {
        const calls: string[] = []
        const animation = new SequenceCallbackAnimation(
            [
                { time: 0.2, onLeave: () => calls.push("a") },
                { time: 0.5, onLeave: () => calls.push("b") },
                { time: 0.8, onLeave: () => calls.push("c") },
            ],
            1000
        )

        // Start at the end
        animation.time = 1
        calls.length = 0 // Clear any onEnter calls

        // Scrub back to start
        animation.time = 0

        expect(calls).toEqual(["c", "b", "a"])
    })

    test("Does not fire when time stays on same side of callback", () => {
        const onEnter = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 0.5, onEnter }],
            1000
        )

        animation.time = 0.1
        animation.time = 0.3
        animation.time = 0.4

        expect(onEnter).not.toHaveBeenCalled()
    })

    test("Reports correct duration", () => {
        const animation = new SequenceCallbackAnimation([], 2000)
        expect(animation.duration).toBe(2)
    })

    test("Handles complete() by firing remaining callbacks", () => {
        const onEnter = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 0.5, onEnter }],
            1000
        )

        animation.time = 0
        animation.complete()

        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    test("Works with callbacks at time 0", () => {
        const onEnter = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 0, onEnter }],
            1000
        )

        // Set time just past 0
        animation.time = 0.01
        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    test("Works with callbacks at end of animation", () => {
        const onEnter = jest.fn()
        const animation = new SequenceCallbackAnimation(
            [{ time: 1, onEnter }],
            1000
        )

        animation.time = 0.5
        animation.time = 1

        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    test("Handles empty callbacks array", () => {
        const animation = new SequenceCallbackAnimation([], 1000)

        // Should not throw
        animation.time = 0.5
        animation.time = 1

        expect(animation.duration).toBe(1)
    })

    test("Playback controls work correctly", () => {
        const animation = new SequenceCallbackAnimation([], 1000)

        expect(animation.state).toBe("running")

        animation.pause()
        expect(animation.state).toBe("paused")

        animation.play()
        expect(animation.state).toBe("running")

        animation.stop()
        expect(animation.state).toBe("idle")
    })
})
