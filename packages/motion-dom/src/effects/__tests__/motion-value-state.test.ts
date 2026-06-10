import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { MotionValueState, slotBase, slotOverride } from "../MotionValueState"
import { addStyleValue } from "../style"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("MotionValueState slots", () => {
    it("composes contributors in index order, not registration order", () => {
        const state = new MotionValueState()

        state.contribute("output", 1, (_state, prev) => `${prev}-second`)
        state.contribute("output", 0, () => "first")

        expect(state.build("output")).toBe("first-second")
    })

    it("skips removed contributors and re-composes", () => {
        const state = new MotionValueState()

        state.contribute("output", slotBase, () => "base")
        const removeOverride = state.contribute(
            "output",
            slotOverride,
            () => "override"
        )

        expect(state.build("output")).toBe("override")

        removeOverride()

        expect(state.build("output")).toBe("base")
    })

    it("supports passthrough contributors that return prev", () => {
        const state = new MotionValueState()

        state.contribute("output", slotBase, () => "base")
        state.contribute("output", slotOverride, (_state, prev) => prev)

        expect(state.build("output")).toBe("base")
    })

    it("returns undefined for slots with no contributors", () => {
        const state = new MotionValueState()
        expect(state.build("output")).toBeUndefined()
    })

    it("renders overridden transform and restores base on contributor removal", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()
        const x = motionValue(100)

        addStyleValue(element, state, "x", x)

        await nextFrame()

        expect(element.style.transform).toBe("translateX(100px)")

        // Override the transform slot, as projection will during layout animations
        const removeOverride = state.contribute(
            "transform",
            slotOverride,
            () => "translateX(999px) scale(2)"
        )

        await nextFrame()

        expect(element.style.transform).toBe("translateX(999px) scale(2)")

        // Tracked values still update latest while overridden
        x.set(200)

        await nextFrame()

        expect(element.style.transform).toBe("translateX(999px) scale(2)")

        // Removing the override re-renders with the base builder
        removeOverride()

        await nextFrame()

        expect(element.style.transform).toBe("translateX(200px)")
    })

    it("wraps the built transform with a higher-index contributor", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()
        const x = motionValue(50)

        addStyleValue(element, state, "x", x)

        // Wrap as a transformTemplate would
        state.contribute(
            "transform",
            slotOverride,
            (_state, prev) => `perspective(500px) ${prev}`
        )

        await nextFrame()

        expect(element.style.transform).toBe(
            "perspective(500px) translateX(50px)"
        )

        x.set(75)

        await nextFrame()

        expect(element.style.transform).toBe(
            "perspective(500px) translateX(75px)"
        )
    })

    it("stores raw values in latest", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()

        addStyleValue(element, state, "x", motionValue(100))
        addStyleValue(element, state, "width", motionValue(50))

        await nextFrame()

        // latest stores raw values, coercion happens at render
        expect(state.latest.x).toBe(100)
        expect(state.latest.width).toBe(50)
        expect(element.style.width).toBe("50px")
        expect(element.style.transform).toBe("translateX(100px)")
    })
})
