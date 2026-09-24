import { defaultOffset, interpolate } from "motion-dom"
import { clamp } from "motion-utils"
import { createScrollInfo } from "../../info"
import { resolveOffsets } from "../index"

/**
 * Progress used to come from
 * clamp(0, 1, interpolate(offsets, defaultOffset(offsets), { clamp: false })(v)).
 */
function interpolatedProgress(offsets: number[], v: number) {
    return clamp(
        0,
        1,
        interpolate(offsets, defaultOffset(offsets), { clamp: false })(v)
    )
}

const container = document.createElement("div")

/**
 * With target === container and zero lengths, a "<n>px" edge resolves to
 * exactly n, so offsets can be specified directly.
 */
function progressFor(offsets: number[], v: number) {
    const info = createScrollInfo()
    info.y.current = v
    resolveOffsets(container, info, {
        offset: offsets.map((o) => `${o}px` as const),
    })
    expect(info.y.offset).toEqual(offsets)
    return info.y.progress
}

describe("resolveOffsets progress", () => {
    test.each([
        [[100], 50],
        [[0, 100], -10],
        [[0, 100], 50],
        [[0, 100], 150],
        [[0, 100, 400], 250],
        [[400, 100, 0], 250],
        [[400, 100, 0], 500],
        [[100, 100, 300], 50],
        [[100, 100, 300], 100],
        [[300, 50, 50], 3],
        [[250, 200, 150, 200, 200], -64],
        [[0, 200, 200, 400], 200],
    ])("offsets %j at %d match interpolate()", (offsets, v) => {
        expect(progressFor(offsets, v)).toBeCloseTo(
            interpolatedProgress(offsets, v),
            10
        )
    })

    test("matches interpolate() across randomised offsets", () => {
        let seed = 1
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647

        for (let t = 0; t < 20000; t++) {
            const length = 1 + Math.floor(random() * 5)
            const mode = random()
            const offsets: number[] = []

            for (let i = 0; i < length; i++) {
                offsets.push(
                    mode < 0.2
                        ? 100
                        : mode < 0.5
                        ? Math.round(random() * 10) * 50
                        : Math.round(random() * 1000)
                )
            }

            if (mode > 0.5 && mode < 0.8) offsets.sort((a, b) => a - b)
            if (mode >= 0.8) offsets.sort((a, b) => b - a)

            const v = Math.round(random() * 1200) - 100

            const actual = progressFor(offsets, v)
            const expected = interpolatedProgress(offsets, v)

            if (Math.abs(actual - expected) > 1e-9) {
                throw new Error(
                    `offsets ${JSON.stringify(offsets)} at ${v}: ${actual} !== ${expected}`
                )
            }
        }
    })
})
