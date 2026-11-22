import { removeHeldOffsets } from "../accelerate-transform"

describe("removeHeldOffsets", () => {
    const linear = (v: number) => v
    const easeA = (v: number) => v * v
    const easeB = (v: number) => v * v * v

    test("removes the held ends useTransform pads a range with", () => {
        expect(
            removeHeldOffsets([0, 0, 200, 200], [0, 0, 1, 1], linear)
        ).toEqual({ keyframes: [0, 200], times: [0, 1], ease: linear })
    })

    test("removes the easing of each span it removes", () => {
        expect(
            removeHeldOffsets(
                [0, 0, 200, 200],
                [0, 0, 1, 1],
                [linear, easeA, easeB]
            )
        ).toEqual({ keyframes: [0, 200], times: [0, 1], ease: [easeA] })
    })

    test("keeps keyframes inside the range", () => {
        expect(
            removeHeldOffsets([5, 5, 10, 20, 20], [0, 0.2, 0.5, 0.8, 1], linear)
        ).toEqual({
            keyframes: [5, 5, 10, 20, 20],
            times: [0, 0.2, 0.5, 0.8, 1],
            ease: linear,
        })
    })

    test("keeps a jump at one offset", () => {
        expect(removeHeldOffsets([0, 0, 100], [0, 0.5, 0.5], linear)).toEqual({
            keyframes: [0, 0, 100],
            times: [0, 0.5, 0.5],
            ease: linear,
        })
    })
})
