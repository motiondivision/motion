import { frame } from "../../frameloop"
import { buildTransform } from "../../render/html/utils/build-transform"
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
        state.scheduleRender("x")

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
        state.scheduleRender("x")

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

    it("re-renders slots without removed values", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()

        addStyleValue(element, state, "x", motionValue(100))
        addStyleValue(element, state, "y", motionValue(50))
        state.scheduleRender("x")
        state.scheduleRender("y")

        await nextFrame()

        expect(element.style.transform).toBe(
            "translateX(100px) translateY(50px)"
        )

        state.remove("x")

        await nextFrame()

        expect(state.latest.x).toBeUndefined()
        expect(element.style.transform).toBe("translateY(50px)")
    })

    it("removes plain values from latest without clearing rendered style", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()
        const opacity = motionValue(0.5)

        addStyleValue(element, state, "opacity", opacity)
        state.scheduleRender("opacity")

        await nextFrame()

        expect(element.style.opacity).toBe("0.5")

        state.remove("opacity")

        // Rendered style is left in place - removal of non-slot styles
        // is the responsibility of the framework layer (e.g. React)
        expect(state.latest.opacity).toBeUndefined()
        expect(state.get("opacity")).toBeUndefined()
        expect(element.style.opacity).toBe("0.5")

        // Value no longer drives the style
        opacity.set(1)

        await nextFrame()

        expect(element.style.opacity).toBe("0.5")
    })

    it("supports transformTemplate by replacing the base contributor", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()
        const x = motionValue(100)

        addStyleValue(element, state, "x", x)
        state.scheduleRender("x")

        await nextFrame()

        expect(element.style.transform).toBe("translateX(100px)")

        // As VisualElement will when transformTemplate is provided via props
        const transformValues = {}
        state.contribute("transform", slotBase, ({ latest }) =>
            buildTransform(
                latest,
                transformValues,
                (values, generated) =>
                    `translateZ(10px) ${generated} /* ${values.x} */`
            )
        )

        await nextFrame()

        expect(element.style.transform).toBe(
            "translateZ(10px) translateX(100px) /* 100px */"
        )

        x.set(0)

        await nextFrame()

        // Default-valued transforms still pass coerced values to the template
        expect(element.style.transform).toBe("translateZ(10px)  /* 0px */")
    })

    it("stores raw values in latest", async () => {
        const element = document.createElement("div")
        const state = new MotionValueState()

        addStyleValue(element, state, "x", motionValue(100))
        addStyleValue(element, state, "width", motionValue(50))
        state.scheduleRender("x")
        state.scheduleRender("width")

        await nextFrame()

        // latest stores raw values, coercion happens at render
        expect(state.latest.x).toBe(100)
        expect(state.latest.width).toBe(50)
        expect(element.style.width).toBe("50px")
        expect(element.style.transform).toBe("translateX(100px)")
    })
})
