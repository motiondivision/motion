import { frame, motionValue } from "motion-dom"
import { timeline } from ".."

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const linear = { defaultTransition: { ease: "linear" as const } }
const paused = { ...linear, autoplay: false }

describe("timeline", () => {
    test("plays segments like animate()", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 0.05 }]], linear)

        await tl
        expect(v.get()).toBe(100)
    })

    test("segments can be added after creation", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 1 }]], paused)

        expect(tl.duration).toBe(1)

        tl.add([v, 200, { duration: 1 }])
        expect(tl.duration).toBe(2)

        tl.time = 1.5
        await nextFrame()
        expect(v.get()).toBe(150)
    })

    test("changes are batched", async () => {
        const v = motionValue(0)
        const tl = timeline([], paused)
        const build = jest.spyOn(tl as any, "build")

        tl.add([v, 1, { duration: 1 }])
            .add([v, 2, { duration: 1 }])
            .add([v, 3, { duration: 1 }])

        await Promise.resolve()
        expect(build).toHaveBeenCalledTimes(1)
        expect(tl.duration).toBe(3)
    })

    test("rebuilds from the original starting values", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 1 }]], paused)

        tl.time = 1
        await nextFrame()
        expect(v.get()).toBe(100)

        tl.add([v, 200, { duration: 1 }])
        tl.time = 0.5
        await nextFrame()
        expect(v.get()).toBe(50)
    })

    test("rebuilds from the original starting values after finishing", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 0.05 }]], linear)

        await tl
        expect(v.get()).toBe(100)

        tl.add([v, 200, { duration: 0.05 }])
        tl.pause()
        tl.time = 0.025
        await nextFrame()
        expect(v.get()).toBe(50)
    })

    test("keeps the playhead when changed while playing", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 1 }]], linear)

        await wait(100)
        const before = tl.time
        expect(before).toBeGreaterThan(0)

        tl.add([v, 200, { duration: 1 }])
        expect(tl.duration).toBe(2)
        expect(tl.time).toBeGreaterThanOrEqual(before)
        expect(tl.state).toBe("running")
        tl.stop()
    })

    test("continues to new segments added after it finished", async () => {
        const v = motionValue(0)
        const onComplete = jest.fn()
        const tl = timeline([[v, 100, { duration: 0.05 }]], {
            ...linear,
            onComplete,
        })

        await tl
        expect(onComplete).toHaveBeenCalledTimes(1)

        tl.add([v, 200, { duration: 0.05 }])
        await tl
        expect(v.get()).toBe(200)
        expect(onComplete).toHaveBeenCalledTimes(2)
    })

    test("labels can be added, read and seeked to", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 1 }]], paused)

        tl.add("middle").add([v, 200, { duration: 1 }])
        expect(tl.getLabelTime("middle")).toBe(1)
        expect(tl.getLabelTime("missing")).toBe(undefined)

        tl.seek("middle")
        await nextFrame()
        expect(v.get()).toBe(100)
    })

    test("segments can be positioned by label", () => {
        const v = motionValue(0)
        const tl = timeline(
            [[v, 100, { duration: 1 }], { name: "end", at: 3 }],
            paused
        )

        tl.add([v, 200, { duration: 1 }], "end")
        expect(tl.duration).toBe(4)
    })

    test("segments can be moved", () => {
        const v = motionValue(0)
        const w = motionValue(0)
        const segment = [w, 100, { duration: 1 }] as const
        const tl = timeline([[v, 100, { duration: 1 }]], paused)

        tl.add(segment as any)
        expect(tl.duration).toBe(2)

        tl.move(segment as any, 0)
        expect(tl.duration).toBe(1)

        tl.move(segment as any, 2)
        expect(tl.duration).toBe(3)
    })

    test("segments can be removed", async () => {
        const v = motionValue(0)
        const w = motionValue(0)
        const segment: any = [w, 100, { duration: 1 }]
        const tl = timeline([[v, 100, { duration: 1 }], segment], paused)

        tl.time = 2
        await nextFrame()
        expect(w.get()).toBe(100)

        tl.remove(segment)
        expect(tl.duration).toBe(1)
        await nextFrame()
        expect(w.get()).toBe(0)
    })

    test("timelines can be nested", async () => {
        const a = motionValue(0)
        const b = motionValue(0)
        const child = timeline([[b, 100, { duration: 1 }]], linear)
        const parent = timeline([[a, 100, { duration: 1 }]], paused)

        parent.add(child)
        expect(parent.duration).toBe(2)

        parent.time = 1.5
        await nextFrame()
        expect(b.get()).toBe(50)

        /**
         * Changing the child rebuilds the parent.
         */
        child.add([b, 200, { duration: 1 }])
        expect(parent.duration).toBe(3)

        parent.time = 2.5
        await nextFrame()
        expect(b.get()).toBe(150)
    })

    test("numeric positions in a nested timeline are relative to its start", () => {
        const a = motionValue(0)
        const child = timeline([[a, 100, { duration: 1, at: 0.5 }]])
        const parent = timeline([], paused)

        parent.add(child, 2)
        expect(parent.duration).toBe(3.5)
    })

    test("callbacks fire when the playhead crosses them", async () => {
        const v = motionValue(0)
        const callback = jest.fn()
        const tl = timeline([[v, 100, { duration: 0.1 }]], linear)

        tl.call(callback, 0.05)
        await tl
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("callbacks at 0 fire when playback starts", async () => {
        const v = motionValue(0)
        const callback = jest.fn()
        const tl = timeline([[v, 100, { duration: 0.05 }]], linear)

        tl.call(callback, 0)
        await tl
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("callbacks past the end extend the duration", async () => {
        const v = motionValue(0)
        const callback = jest.fn()
        const tl = timeline([[v, 100, { duration: 0.05 }]], linear)

        tl.call(callback, 0.1)
        expect(tl.duration).toBe(0.1)
        await tl
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("callbacks don't fire when seeking", async () => {
        const v = motionValue(0)
        const callback = jest.fn()
        const tl = timeline([[v, 100, { duration: 1 }]], paused)

        tl.call(callback, 0.5)
        tl.time = 0.75
        await nextFrame()
        await nextFrame()
        expect(callback).not.toHaveBeenCalled()
    })

    test("addPause() pauses at its position", async () => {
        const v = motionValue(0)
        const onPause = jest.fn()
        const tl = timeline([[v, 100, { duration: 0.2 }]], linear)

        tl.addPause(0.05, onPause)
        await wait(150)

        expect(onPause).toHaveBeenCalledTimes(1)
        expect(tl.state).toBe("paused")
        expect(tl.time).toBeCloseTo(0.05)
        await nextFrame()
        expect(v.get()).toBeCloseTo(25)

        tl.play()
        await tl
        expect(v.get()).toBe(100)
        expect(onPause).toHaveBeenCalledTimes(1)
    })

    test("playTo() plays to a label and pauses", async () => {
        const v = motionValue(0)
        const tl = timeline(
            [[v, 100, { duration: 0.05 }], "middle", [v, 200, { duration: 1 }]],
            paused
        )

        tl.playTo("middle")
        await wait(150)

        expect(tl.state).toBe("paused")
        expect(tl.time).toBeCloseTo(0.05)
    })

    test("playTo() plays backwards to an earlier label", async () => {
        const v = motionValue(0)
        const tl = timeline(
            [
                [v, 100, { duration: 0.05 }],
                "middle",
                [v, 200, { duration: 0.05 }],
            ],
            paused
        )

        tl.time = 0.1
        tl.playTo("middle")
        expect(tl.speed).toBe(-1)
        await wait(150)

        expect(tl.state).toBe("paused")
        expect(tl.time).toBeCloseTo(0.05)
    })

    test("progress gets and sets the playhead", async () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 2 }]], paused)

        tl.progress = 0.25
        expect(tl.time).toBe(0.5)
        expect(tl.progress).toBe(0.25)
    })

    test("clear() removes everything", () => {
        const v = motionValue(0)
        const tl = timeline([[v, 100, { duration: 2 }]], paused)

        tl.clear()
        expect(tl.duration).toBe(0)
    })

    test("the duration option stretches segments, labels and callbacks", async () => {
        const v = motionValue(0)
        const tl = timeline(
            [[v, 100, { duration: 1 }], "end", [v, 200, { duration: 1 }]],
            { ...paused, duration: 4 }
        )

        expect(tl.duration).toBe(4)
        expect(tl.getLabelTime("end")).toBe(2)

        tl.time = 1
        await nextFrame()
        expect(v.get()).toBe(50)
    })

    test("registers with a scope so it stops with it", () => {
        const v = motionValue(0)
        const scope = { current: undefined, animations: [] } as any
        const tl = timeline([[v, 100, { duration: 1 }]], { ...paused, scope })

        expect(scope.animations).toContain(tl)
    })

    test("inherits skipAnimations from a useAnimate() scope", async () => {
        const v = motionValue(0)
        const scope = {
            current: undefined,
            animations: [],
            skipAnimations: true,
        } as any
        const tl = timeline([[v, 100, { duration: 10 }]], { ...linear, scope })

        await tl
        await nextFrame()
        expect(v.get()).toBe(100)
        expect(tl.time).toBe(0)
    })

    test("resolves selectors while created, before the scope can detach", () => {
        const container = document.createElement("div")
        container.innerHTML = `<div class="box"></div>`
        const scope = { current: container, animations: [] } as any
        const tl = timeline([[".box", { opacity: 0 }, { duration: 1 }]], {
            ...paused,
            scope,
        })

        /**
         * React 19 Strict Mode detaches refs between its simulated
         * unmount and remount.
         */
        scope.current = null
        expect(tl.duration).toBe(1)
    })
})
