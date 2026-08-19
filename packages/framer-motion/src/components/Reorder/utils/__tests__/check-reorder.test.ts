import { ItemData } from "../../types"
import { checkReorder } from "../check-reorder"
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
})
