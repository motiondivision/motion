import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("MotionValueState", () => {
    it("stores the latest value with its default value type", async () => {
        const state = new MotionValueState()
        const width = motionValue(100)
        const render = jest.fn()

        state.set("width", width, render)
        expect(state.latest.width).toBe("100px")
        expect(render).not.toHaveBeenCalled()

        width.set(200)
        expect(state.latest.width).toBe("200px")
        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })

    it("stores the raw value when useDefaultValueType is false", () => {
        const state = new MotionValueState()
        const x = motionValue(100)

        state.set("x", x, undefined, undefined, false)
        expect(state.latest.x).toBe(100)
    })

    it("schedules the computed value's render when a source value changes", async () => {
        const state = new MotionValueState()
        const transform = motionValue("none")
        const x = motionValue(0)
        const y = motionValue(0)
        const render = jest.fn()

        state.set("transform", transform, render)
        state.set("x", x, undefined, transform, false)
        state.set("y", y, undefined, transform, false)
        await nextFrame()
        render.mockClear()

        x.set(100)
        y.set(100)
        expect(state.latest.x).toBe(100)
        expect(state.latest.y).toBe(100)
        expect(render).not.toHaveBeenCalled()

        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })

    it("removing a source value doesn't cancel the computed value's render", async () => {
        const state = new MotionValueState()
        const transform = motionValue("none")
        const x = motionValue(0)
        const y = motionValue(0)
        const render = jest.fn()

        state.set("transform", transform, render)
        const removeX = state.set("x", x, undefined, transform, false)
        state.set("y", y, undefined, transform, false)
        await nextFrame()
        render.mockClear()

        y.set(100)
        removeX()
        expect(state.get("x")).toBeUndefined()
        expect(state.get("y")).toBe(y)

        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)

        x.set(200)
        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })

    it("keeps a bound value's animation alive when an unrelated change listener unsubscribes", async () => {
        const state = new MotionValueState()
        const opacity = motionValue(1)
        const animation = { stop: jest.fn() }
        opacity.start(() => animation as any)

        state.set("opacity", opacity, () => {})
        opacity.on("change", () => {})()

        await nextFrame()
        expect(animation.stop).not.toHaveBeenCalled()
    })

    it("stops a bound value's animation once nothing subscribes to it", async () => {
        const state = new MotionValueState()
        const opacity = motionValue(1)
        const animation = { stop: jest.fn() }
        opacity.start(() => animation as any)

        const remove = state.set("opacity", opacity, () => {})
        remove()

        await nextFrame()
        expect(animation.stop).toHaveBeenCalledTimes(1)
    })

    it("renders values bound by two states", async () => {
        const a = new MotionValueState()
        const b = new MotionValueState()
        const x = motionValue(0)
        const renderA = jest.fn()
        const renderB = jest.fn()

        a.set("x", x, renderA)
        b.set("x", x, renderB)
        x.set(10)

        await nextFrame()
        expect(a.latest.x).toBe("10px")
        expect(b.latest.x).toBe("10px")
        expect(renderA).toHaveBeenCalledTimes(1)
        expect(renderB).toHaveBeenCalledTimes(1)
    })

    it("removing a value cancels its scheduled render", async () => {
        const state = new MotionValueState()
        const opacity = motionValue(1)
        const render = jest.fn()

        const remove = state.set("opacity", opacity, render)
        opacity.set(0.5)
        remove()

        await nextFrame()
        expect(render).not.toHaveBeenCalled()
    })
})
