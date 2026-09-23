import { easeInOut, noop } from "motion-utils"
import { defaultOffset } from "../../keyframes/offsets/default"
import { convertOffsetToTimes } from "../../keyframes/offsets/time"
import { AnyResolvedKeyframe, KeyframeGenerator } from "../../types"
import { defaultEasing, keyframes } from "../keyframes"

function animateSync(
    animation: KeyframeGenerator<AnyResolvedKeyframe>,
    timeStep = 200,
    round = true
) {
    const output: Array<AnyResolvedKeyframe> = []
    let step = 0
    let done = false

    while (!done) {
        const latest = animation.next(step * timeStep)
        output.push(
            round && typeof latest.value === "number"
                ? Math.round(latest.value)
                : latest.value
        )
        done = latest.done
        step++
    }

    return output
}

const linear = noop

describe("defaultEasing", () => {
    test("returns a default easing array", () => {
        expect(defaultEasing([0, 1], linear)).toEqual([linear])
        expect(defaultEasing([0, 1, 2], linear)).toEqual([linear, linear])
        expect(defaultEasing([0, 1, 2])).toEqual([easeInOut, easeInOut])
    })
})

describe("defaultOffset", () => {
    test("returns a default times array", () => {
        expect(defaultOffset([0, 1])).toEqual([0, 1])
        expect(defaultOffset([0, 1, 2])).toEqual([0, 0.5, 1])
        expect(defaultOffset([0, 1, 2, 3])).toEqual([0, 1 / 3, (1 / 3) * 2, 1])
    })
})

describe("convertOffsetToTimes", () => {
    test("converts offsets to times", () => {
        expect(convertOffsetToTimes([0, 0.5, 1], 500)).toEqual([0, 250, 500])
    })
})

describe("keyframes", () => {
    test("runs a default animation", () => {
        expect(animateSync(keyframes({ keyframes: [0, 100] }), 20)).toEqual([
            0, 1, 4, 8, 15, 23, 33, 44, 56, 67, 77, 85, 92, 96, 99, 100,
        ])
    })

    test("adjusts with duration defined", () => {
        expect(
            animateSync(
                keyframes({ keyframes: [0, 100], duration: 100, ease: linear }),
                20
            )
        ).toEqual([0, 20, 40, 60, 80, 100])
    })

    test("animates through keyframes", () => {
        expect(
            animateSync(
                keyframes({
                    keyframes: [50, 100, -100],
                    duration: 200,
                    ease: linear,
                }),
                20
            )
        ).toEqual([50, 60, 70, 80, 90, 100, 60, 20, -20, -60, -100])
    })

    test("clamps two keyframes to the duration", () => {
        const generator = keyframes({
            keyframes: [0, 100],
            duration: 100,
            ease: linear,
        })
        expect(generator.next(-50).value).toBe(0)
        expect(generator.next(50).value).toBe(50)
        expect(generator.next(50).done).toBe(false)
        expect(generator.next(150).value).toBe(100)
        expect(generator.next(150).done).toBe(true)
    })

    test("two keyframes with a zero duration resolve to the target", () => {
        const generator = keyframes({
            keyframes: [0, 100],
            duration: 0,
            ease: linear,
        })
        expect(generator.next(0)).toEqual({ value: 100, done: true })
    })

    test("two identical keyframes hold the value", () => {
        const generator = keyframes({
            keyframes: ["50%", "50%"] as any,
            duration: 100,
            ease: linear,
        })
        expect(generator.next(50).value).toBe("50%")
        expect(generator.next(150).done).toBe(true)
    })

    test("two keyframes honour times", () => {
        const withDefaultTimes = keyframes({
            keyframes: [0, 100],
            duration: 100,
            ease: linear,
            times: [0, 1],
        })
        expect(withDefaultTimes.next(50).value).toBe(50)

        const withOffsetTimes = keyframes({
            keyframes: [0, 100],
            duration: 100,
            ease: linear,
            times: [0.5, 1],
        })
        expect(withOffsetTimes.next(50).value).toBe(0)
        expect(withOffsetTimes.next(75).value).toBe(50)
    })

    test("two keyframes accept an easing array", () => {
        expect(
            animateSync(
                keyframes({
                    keyframes: [0, 100],
                    duration: 100,
                    ease: [linear],
                }),
                20
            )
        ).toEqual([0, 20, 40, 60, 80, 100])
    })

    /**
     * https://github.com/motiondivision/motion/issues/3827
     *
     * In production, invariant() is a no-op so an unrecognised easing string
     * (like the CSS "ease" keyword, which WAAPI accepts) resolves to undefined.
     * Multi-keyframe animations fall back to easeInOut via defaultEasing, but
     * the two-keyframe fast path calls the undefined easing directly.
     */
    describe("with an unrecognised easing in production", () => {
        let prodKeyframes: typeof keyframes
        const originalEnv = process.env.NODE_ENV

        beforeAll(() => {
            process.env.NODE_ENV = "production"
            jest.isolateModules(() => {
                prodKeyframes = require("../keyframes").keyframes
            })
        })

        afterAll(() => {
            process.env.NODE_ENV = originalEnv
        })

        test("three keyframes fall back to the default easing", () => {
            expect(
                animateSync(
                    prodKeyframes({
                        keyframes: [0, 50, 100],
                        duration: 100,
                        ease: "ease" as any,
                    }),
                    20
                )
            ).toEqual(
                animateSync(
                    prodKeyframes({ keyframes: [0, 50, 100], duration: 100 }),
                    20
                )
            )
        })

        test("two keyframes fall back to the default easing", () => {
            const generator = prodKeyframes({
                keyframes: [0, 100],
                duration: 100,
                ease: "ease" as any,
            })

            expect(() => generator.next(50)).not.toThrow()
            expect(animateSync(generator, 20)).toEqual(
                animateSync(
                    prodKeyframes({ keyframes: [0, 100], duration: 100 }),
                    20
                )
            )
        })
    })

    test("animates unit strings", () => {
        expect(
            animateSync(
                keyframes({
                    keyframes: ["0%", "50%"] as any,
                    duration: 100,
                    ease: linear,
                }),
                20,
                false
            )
        ).toEqual(["0%", "10%", "20%", "30%", "40%", "50%"])
    })

    test("animates colors", () => {
        expect(
            animateSync(
                keyframes({
                    keyframes: ["#fff", "#000"] as any,
                    duration: 100,
                    ease: linear,
                }),
                20,
                false
            )
        ).toEqual([
            "rgba(255, 255, 255, 1)",
            "rgba(228, 228, 228, 1)",
            "rgba(198, 198, 198, 1)",
            "rgba(161, 161, 161, 1)",
            "rgba(114, 114, 114, 1)",
            "rgba(0, 0, 0, 1)",
        ])
    })
})
