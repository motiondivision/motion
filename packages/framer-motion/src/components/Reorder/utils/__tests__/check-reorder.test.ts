import { ItemData } from "../../types"
import { moveItem } from "motion-utils"
import { checkReorder, keyTarget } from "../check-reorder"
import { detectAxis } from "../detect-axis"

const wrapped: ItemData<string>[] = [
    {
        value: "a",
        layout: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
    },
    {
        value: "b",
        layout: { x: { min: 100, max: 200 }, y: { min: 0, max: 100 } },
    },
    {
        value: "c",
        layout: { x: { min: 0, max: 100 }, y: { min: 100, max: 200 } },
    },
    {
        value: "d",
        layout: {
            x: { min: 100, max: 200 },
            y: { min: 100, max: 200 },
        },
    },
]

describe("Reorder layout utils", () => {
    test("detects horizontal, vertical, and wrapped layouts", () => {
        expect(
            detectAxis(wrapped.slice(0, 2).map(({ layout }) => layout))
        ).toBe("x")
        expect(detectAxis([wrapped[0].layout, wrapped[2].layout])).toBe("y")
        expect(detectAxis(wrapped.map(({ layout }) => layout))).toBe("xy")
    })

    test("moves into a wrapped row", () => {
        expect(
            checkReorder(
                wrapped,
                "a",
                { x: 100, y: 100 },
                { x: 1, y: 1 },
                "xy"
            ).map(({ value }) => value)
        ).toEqual(["b", "c", "d", "a"])
    })

    test("waits until the dragged center crosses a large gap", () => {
        const spaced = [
            wrapped[0],
            {
                value: "b",
                layout: {
                    x: { min: 200, max: 300 },
                    y: { min: 0, max: 100 },
                },
            },
        ]

        expect(
            checkReorder(spaced, "a", { x: 100, y: 0 }, { x: 1, y: 0 }, "xy")
        ).toBe(spaced)
        expect(
            checkReorder(
                spaced,
                "a",
                { x: 101, y: 0 },
                { x: 1, y: 0 },
                "xy"
            ).map(({ value }) => value)
        ).toEqual(["b", "a"])
    })

    test.each([
        [
            "ltr",
            [
                {
                    value: "first",
                    layout: {
                        x: { min: 0, max: 80 },
                        y: { min: 0, max: 80 },
                    },
                },
                {
                    value: "dragged",
                    layout: {
                        x: { min: 100, max: 180 },
                        y: { min: 0, max: 80 },
                    },
                },
                {
                    value: "next",
                    layout: {
                        x: { min: 0, max: 80 },
                        y: { min: 100, max: 180 },
                    },
                },
            ],
        ],
        [
            "rtl",
            [
                {
                    value: "first",
                    layout: {
                        x: { min: 100, max: 180 },
                        y: { min: 0, max: 80 },
                    },
                },
                {
                    value: "dragged",
                    layout: {
                        x: { min: 0, max: 80 },
                        y: { min: 0, max: 80 },
                    },
                },
                {
                    value: "next",
                    layout: {
                        x: { min: 100, max: 180 },
                        y: { min: 100, max: 180 },
                    },
                },
            ],
        ],
    ] as const)(
        "inserts into the empty end of a wrapped %s row",
        (direction, layout) => {
            expect(
                checkReorder(
                    [...layout],
                    "dragged",
                    { x: 0, y: 100 },
                    { x: 0, y: 0 },
                    "xy",
                    direction
                ).map(({ value }) => value)
            ).toEqual(["first", "next", "dragged"])
        }
    )

    test("preserves single-axis reorder thresholds", () => {
        const horizontal = wrapped.slice(0, 2)

        expect(
            checkReorder(horizontal, "a", { x: 100, y: 0 }, { x: 1, y: 0 }, "y")
        ).toBe(horizontal)
        expect(
            checkReorder(
                horizontal,
                "a",
                { x: 51, y: 0 },
                { x: 1, y: 0 },
                "x"
            ).map(({ value }) => value)
        ).toEqual(["b", "a"])
    })

    test("moves by the row drawn above or below, not the next in order", () => {
        /**
         * flex-wrap: wrap-reverse draws the first row at the bottom:
         * c
         * a b
         */
        const box = (x: number, y: number) => ({
            x: { min: x, max: x + 100 },
            y: { min: y, max: y + 100 },
        })
        const reversed: ItemData<string>[] = [
            { value: "a", layout: box(0, 100) },
            { value: "b", layout: box(100, 100) },
            { value: "c", layout: box(0, 0) },
        ]
        const move = (value: string, key: number) => {
            const index = reversed.findIndex((item) => item.value === value)
            const target = keyTarget(reversed, index, key, "xy", false)
            return (target < 0 ? reversed : moveItem(reversed, index, target))
                .map((item) => item.value)
                .join("")
        }

        // Up from a goes to c's row, Down from c to a's
        expect(move("a", 0)).toBe("bca")
        expect(move("c", 2)).toBe("cab")
        // Nothing below a or above c
        expect(move("a", 2)).toBe("abc")
        expect(move("c", 0)).toBe("abc")
    })
})
