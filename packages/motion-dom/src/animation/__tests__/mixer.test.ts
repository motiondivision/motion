import { noop } from "motion-utils"
import { motionValue } from "../../value"
import { animateElement } from "../animate/element"
import { animateSingleValue } from "../animate/single-value"
import { JSAnimation } from "../JSAnimation"
import { ValueAnimationOptions } from "../types"
import { interpolate } from "../../utils/interpolate"
import { arc } from "../utils/arc"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { supportsBrowserAnimation } from "../waapi/supports/waapi"
import { syncDriver } from "./utils"

/**
 * These strings have different numbers of values, so the default mixer
 * can't interpolate them and jumps straight to the target.
 */
const from = "M0 0"
const to = "M0 0 L10 10"

const tagMixer = (a: string, b: string) => (p: number) =>
    `${a} > ${b} @ ${Math.round(p * 100)}`

function run(options: Partial<ValueAnimationOptions<string>>) {
    return new Promise<string[]>((resolve) => {
        const output: string[] = []
        new JSAnimation<string>({
            driver: syncDriver(20),
            duration: 100,
            ease: noop,
            keyframes: [from, to],
            onUpdate: (v) => output.push(v),
            onComplete: () => resolve(output),
            ...options,
        })
    })
}

describe("transition.mixer", () => {
    test("mixes two keyframes", async () => {
        const output = await run({ mixer: tagMixer })

        expect(output.slice(0, 5)).toEqual([
            `${from} > ${to} @ 0`,
            `${from} > ${to} @ 20`,
            `${from} > ${to} @ 40`,
            `${from} > ${to} @ 60`,
            `${from} > ${to} @ 80`,
        ])
    })

    test("mixes between each pair of keyframes", async () => {
        const output = await run({
            keyframes: ["a 0", "b 0 0", "c 0 0 0"],
            mixer: tagMixer,
        })

        expect(output).toContain("a 0 > b 0 0 @ 40")
        expect(output).toContain("b 0 0 > c 0 0 0 @ 20")
    })

    test("mixes non-numeric keyframes in spring animations", async () => {
        const output = await run({
            type: "spring",
            stiffness: 100,
            damping: 20,
            mixer: tagMixer,
        })

        const mid = output.filter((v) => !v.endsWith("@ 0") && v !== to)
        expect(mid.length).toBeGreaterThan(0)
        for (const v of mid)
            expect(v.startsWith(`${from} > ${to} @`)).toBe(true)
    })

    test("leaves keyframes to the default mixer when it returns nothing", async () => {
        const decline = () => undefined

        const tween = await run({
            keyframes: ["0px", "100px"],
            mixer: decline,
        })
        expect(tween).toContain("20px")

        const keyframes = await run({
            keyframes: ["0px", "100px", "0px"],
            mixer: decline,
        })
        expect(keyframes).toContain("40px")

        const spring = await run({
            keyframes: ["0px", "100px"],
            type: "spring",
            stiffness: 100,
            damping: 20,
            mixer: decline,
        })
        expect(
            spring.some((v) => parseFloat(v) > 0 && parseFloat(v) < 100)
        ).toBe(true)

        expect(interpolate([0, 1], [0, 100], { mixer: decline })(0.5)).toBe(50)
    })

    test("keeps a value's default transition", () => {
        expect(isTransitionDefined({ mixer: tagMixer })).toBe(false)
        expect(isTransitionDefined({ mixer: tagMixer, duration: 1 })).toBe(true)
    })

    test("leaves numbers to the usual blending", async () => {
        const mixer = jest.fn(() => () => 42)

        const tween = await run({
            keyframes: [0, 100] as any,
            mixer,
        })
        expect(tween).toContain(20)

        const keyframes = await run({
            keyframes: [0, 100, 0] as any,
            mixer,
        })
        expect(keyframes).toContain(40)

        expect(mixer).not.toHaveBeenCalled()
    })

    test("leaves the progress of a path to the path", async () => {
        const element = document.createElement("div")
        const mixer = jest.fn()

        await Promise.all(
            animateElement(
                element,
                { x: 100, y: 0 },
                { path: arc(), mixer, duration: 0.05 }
            )
        )

        expect(mixer).not.toHaveBeenCalled()
        expect(element.style.transform).toBe("translateX(100px)")
    })

    test("leaves values Motion can't animate to change at once", async () => {
        const value = motionValue("url(#a1)")
        const output: string[] = []
        value.on("change", (v) => output.push(v))
        const mixer = jest.fn(() => () => "url(#mixed)")

        await animateSingleValue(value, "url(#a2)", { mixer, duration: 0.1 })

        expect(mixer).not.toHaveBeenCalled()
        expect(output).toEqual(["url(#a2)"])
    })

    test("runs values that aren't numbers on the main thread, where the mixer can be called", () => {
        Object.defineProperty(Element.prototype, "animate", {
            value: () => {},
            writable: true,
            configurable: true,
        })

        const options = {
            motionValue: {
                owner: {
                    current: document.createElement("div"),
                    getProps: () => ({}),
                },
            },
            keyframes: ["blur(0px)", "blur(10px)"],
            name: "filter",
        } as any

        expect(supportsBrowserAnimation(options)).toBe(true)
        expect(supportsBrowserAnimation({ ...options, mixer: tagMixer })).toBe(
            false
        )

        // Numbers mix as usual, so they can still run on WAAPI
        expect(
            supportsBrowserAnimation({
                ...options,
                keyframes: [0, 1],
                name: "opacity",
                mixer: tagMixer,
            })
        ).toBe(true)

        delete (Element.prototype as any).animate
    })
})
