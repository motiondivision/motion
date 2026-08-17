import { frame } from "../../../frameloop"
import { motionValue } from "../../../value"
import { varEffect } from ".."

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const getVarName = (value: string) => value.slice(4, -1)
const getRegisteredName = () =>
    (CSS.registerProperty as jest.Mock).mock.calls[0][0].name as string

describe("varEffect", () => {
    const css = globalThis.CSS

    beforeEach(() => {
        ;(globalThis as any).CSS = { registerProperty: jest.fn() }
    })

    afterAll(() => {
        ;(globalThis as any).CSS = css
    })

    it("registers and renders an initial value through a CSS variable", async () => {
        const element = document.createElement("div")
        const setProperty = jest.spyOn(element.style, "setProperty")

        varEffect(element, { opacity: motionValue(0.5) })
        await nextFrame()

        const name = getRegisteredName()
        expect(CSS.registerProperty).toHaveBeenCalledWith({
            name,
            syntax: "*",
            inherits: false,
        })
        expect(setProperty).toHaveBeenCalledWith("opacity", `var(${name})`)
        expect(element.style.getPropertyValue(name)).toBe("0.5")
    })

    it("updates only the CSS variable", async () => {
        const element = document.createElement("div")
        const opacity = motionValue(0.5)

        varEffect(element, { opacity })
        await nextFrame()

        const name = getRegisteredName()
        const setProperty = jest.spyOn(element.style, "setProperty")

        opacity.set(1)
        await nextFrame()

        expect(setProperty).toHaveBeenCalledTimes(1)
        expect(setProperty).toHaveBeenCalledWith(name, 1)
        expect(element.style.getPropertyValue(name)).toBe("1")
    })

    it("composes transform values into one CSS variable", async () => {
        const element = document.createElement("div")
        const x = motionValue(100)
        const scale = motionValue(2)

        varEffect(element, { x, scale })
        await nextFrame()

        const name = getVarName(element.style.transform)
        expect(CSS.registerProperty).toHaveBeenCalledTimes(1)
        expect(element.style.transform).toBe(`var(${name})`)
        expect(element.style.getPropertyValue(name)).toBe(
            "translateX(100px) scale(2)"
        )

        x.set(200)
        await nextFrame()

        expect(element.style.getPropertyValue(name)).toBe(
            "translateX(200px) scale(2)"
        )
    })

    it("falls back to direct style writes", async () => {
        ;(globalThis as any).CSS = {}
        const element = document.createElement("div")

        varEffect(element, { opacity: motionValue(0.5) })
        await nextFrame()

        expect(element.style.opacity).toBe("0.5")
    })

    it("coerces number values with unit types", async () => {
        const element = document.createElement("div")

        varEffect(element, { width: motionValue(100) })
        await nextFrame()

        const name = getRegisteredName()
        expect(element.style.getPropertyValue(name)).toBe("100px")
    })
})
