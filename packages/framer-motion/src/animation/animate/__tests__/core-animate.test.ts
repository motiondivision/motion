import { domEffect, motionValue } from "motion-dom"
import { animate } from "../../../dom-core"

describe("animate from motion/core", () => {
    test("animates a number", async () => {
        let latest = 0
        await animate(0, 100, { duration: 0.01, onUpdate: (v) => (latest = v) })
        expect(latest).toBe(100)
    })

    test("animates a colour", async () => {
        let latest = ""
        await animate("#f00", "#00f", {
            duration: 0.01,
            onUpdate: (v) => (latest = v),
        })
        expect(latest).toBe("#00f")
    })

    test("animates a motion value", async () => {
        const x = motionValue(0)
        await animate(x, 50, { duration: 0.01 })
        expect(x.get()).toBe(50)
    })

    test("animates a plain object", async () => {
        const object = { x: 0, fill: "#000" }
        await animate(object, { x: 20, fill: "#fff" }, { duration: 0.01 })
        expect(object.x).toBe(20)
    })

    test("needs domEffect to animate an element", async () => {
        const element = document.createElement("div")

        expect(() => animate(element, { opacity: 0.5 })).toThrow(
            "animate.addEffect(domEffect)"
        )

        animate.addEffect(domEffect)
        await animate(element, { opacity: 0.5 }, { duration: 0.01 })
        expect(element.style.opacity).toBe("0.5")
    })
})
