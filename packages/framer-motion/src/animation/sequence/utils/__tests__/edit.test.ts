import { ValueSequence } from "../../types"
import { addKeyframes, eraseKeyframes } from "../edit"

describe("eraseKeyframes", () => {
    test("Erase keyframes between the specified time range", () => {
        const sequence: ValueSequence = [
            { value: 1, at: 50 },
            { value: 2, at: 300 },
            { value: 3, at: 299 },
            { value: 4, at: 101 },
            { value: 5, at: 100 },
            { value: 6, at: 350 },
        ]

        eraseKeyframes(sequence, 100, 300)

        expect(sequence).toEqual([
            { value: 1, at: 50 },
            { value: 2, at: 300 },
            { value: 5, at: 100 },
            { value: 6, at: 350 },
        ])
    })
})

describe("addKeyframes", () => {
    test("Adds keyframes to sequence", () => {
        const sequence: ValueSequence = [{ value: 1, at: 50 }]

        addKeyframes(
            sequence,
            [1, 2, 3, 4],
            [0, 1, 2, 3],
            [0, 0.1, 0.5, 1],
            500,
            1000
        )

        expect(sequence).toEqual([
            { value: 1, at: 50 },
            { value: 1, at: 500, easing: [0, 1, 2, 3] },
            { value: 2, at: 550, easing: [0, 1, 2, 3] },
            { value: 3, at: 750, easing: [0, 1, 2, 3] },
            { value: 4, at: 1000, easing: [0, 1, 2, 3] },
        ])

        addKeyframes(
            sequence,
            [5, 6, 7],
            ["easeIn", "easeInOut"],
            [0, 0.5, 1],
            400,
            600
        )

        expect(sequence).toEqual([
            { value: 1, at: 50 },
            { value: 3, at: 750, easing: [0, 1, 2, 3] },
            { value: 4, at: 1000, easing: [0, 1, 2, 3] },
            { value: 5, at: 400, easing: "easeIn" },
            { value: 6, at: 500, easing: "easeInOut" },
            { value: 7, at: 600, easing: "easeIn" },
        ])
    })
})

describe("addKeyframes appending to a sequence", () => {
    /**
     * Reads of the sequence's keyframes, by index.
     */
    const counted = () => {
        let reads = 0
        const sequence = new Proxy([] as ValueSequence, {
            get(target, key, receiver) {
                typeof key === "string" && /^\d+$/.test(key) && reads++
                return Reflect.get(target, key, receiver)
            },
        })
        return { sequence, reads: () => reads }
    }

    test("doesn't scan earlier keyframes for a segment starting after them", () => {
        const { sequence, reads } = counted()
        for (let i = 0; i < 1000; i++) {
            addKeyframes(
                sequence,
                [i, i + 1],
                "linear",
                [0, 1],
                i * 10,
                i * 10 + 10
            )
        }

        expect(sequence.length).toBe(2000)
        expect(reads()).toBeLessThan(100)
    })

    test("still erases keyframes a segment overlaps", () => {
        const sequence: ValueSequence = []
        addKeyframes(sequence, [0, 1], "linear", [0, 1], 0, 100)
        addKeyframes(sequence, [1, 2], "linear", [0, 1], 100, 200)
        addKeyframes(sequence, [5, 6], "linear", [0, 1], 50, 150)

        expect(sequence.map(({ at, value }) => [at, value])).toEqual([
            [0, 0],
            [200, 2],
            [50, 5],
            [150, 6],
        ])
    })
})
