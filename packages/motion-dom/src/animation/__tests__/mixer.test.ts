import { noop } from "motion-utils"
import { JSAnimation } from "../JSAnimation"
import { ValueAnimationOptions } from "../types"
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

    test("keeps a value's default transition", () => {
        expect(isTransitionDefined({ mixer: tagMixer })).toBe(false)
        expect(isTransitionDefined({ mixer: tagMixer, duration: 1 })).toBe(true)
    })

    test("runs on the main thread, where the mixer can be called", () => {
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
            keyframes: [0, 1],
            name: "opacity",
        } as any

        expect(supportsBrowserAnimation(options)).toBe(true)
        expect(supportsBrowserAnimation({ ...options, mixer: tagMixer })).toBe(
            false
        )
    })
})
