import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { releaseNode } from "../../node/MotionNode"
import { MotionValueState } from "../MotionValueState"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("MotionValueState", () => {
    it("schedules one render per frame for a value, reading it at render time", async () => {
        const state = new MotionValueState()
        const width = motionValue(100)
        const rendered: number[] = []
        const render = jest.fn(() => rendered.push(width.get()))

        state.set("width", width, render)
        expect(render).not.toHaveBeenCalled()

        width.set(150)
        width.set(200)
        expect(render).not.toHaveBeenCalled()

        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
        expect(rendered).toEqual([200])
    })

    it("doesn't schedule a render for a value that starts undefined", async () => {
        const state = new MotionValueState()
        const opacity = motionValue<number | undefined>(undefined)
        const render = jest.fn()

        state.set("opacity", opacity, render)
        await nextFrame()
        expect(render).not.toHaveBeenCalled()

        opacity.set(1)
        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })

    it("schedules a shared render once when the values that share it change", async () => {
        const state = new MotionValueState()
        const x = motionValue(0)
        const y = motionValue(0)
        const render = Object.assign(jest.fn(), { shared: true })

        state.set("x", x, render)
        state.set("y", y, render)
        await nextFrame()
        render.mockClear()

        x.set(100)
        y.set(100)
        expect(render).not.toHaveBeenCalled()

        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })

    it("removing a value doesn't cancel the render it shares", async () => {
        const state = new MotionValueState()
        const x = motionValue(0)
        const y = motionValue(0)
        const render = Object.assign(jest.fn(), { shared: true })

        const removeX = state.set("x", x, render)
        state.set("y", y, render)
        await nextFrame()
        render.mockClear()

        y.set(100)
        removeX()
        expect(state.getValue("x")).toBeUndefined()
        expect(state.getValue("y")).toBe(y)

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
        expect(renderA).toHaveBeenCalledTimes(1)
        expect(renderB).toHaveBeenCalledTimes(1)
    })

    it("removing a replaced value leaves the value that replaced it", async () => {
        const state = new MotionValueState()
        const first = motionValue(0)
        const second = motionValue(0)
        const render = jest.fn()

        const removeFirst = state.set("opacity", first, () => {})
        const removeSecond = state.set("opacity", second, render)
        removeFirst()

        expect(state.getValue("opacity")).toBe(second)
        expect(releaseNode(state).get("opacity")).toBe(second)

        second.set(1)
        await nextFrame()
        expect(render).not.toHaveBeenCalled()

        removeSecond()
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
