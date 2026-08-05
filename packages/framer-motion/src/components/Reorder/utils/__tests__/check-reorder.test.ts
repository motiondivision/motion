import { ItemData } from "../../types"
import { checkReorder } from "../check-reorder"
import { detectAxis } from "../detect-axis"

const grid: ItemData<string>[] = [
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

describe("Reorder grid utils", () => {
    test("detects horizontal, vertical, and grid layouts", () => {
        expect(detectAxis(grid.slice(0, 2).map(({ layout }) => layout))).toBe(
            "x"
        )
        expect(detectAxis([grid[0].layout, grid[2].layout])).toBe("y")
        expect(detectAxis(grid.map(({ layout }) => layout))).toBe("xy")
    })

    test("moves an item to the grid cell containing its center", () => {
        expect(
            checkReorder(
                grid,
                "a",
                { x: 100, y: 100 },
                { x: 1, y: 1 },
                "xy"
            ).map(({ value }) => value)
        ).toEqual(["b", "c", "d", "a"])
    })

    test("waits until the dragged center crosses a large gap", () => {
        const spaced = [
            grid[0],
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
                { x: 150, y: 0 },
                { x: 1, y: 0 },
                "xy"
            ).map(({ value }) => value)
        ).toEqual(["b", "a"])
    })

    test("uses value order when dense packing differs from visual order", () => {
        const dense = [
            {
                value: "a",
                layout: {
                    x: { min: 0, max: 200 },
                    y: { min: 0, max: 100 },
                },
            },
            {
                value: "b",
                layout: {
                    x: { min: 0, max: 200 },
                    y: { min: 100, max: 200 },
                },
            },
            {
                value: "c",
                layout: {
                    x: { min: 200, max: 300 },
                    y: { min: 0, max: 100 },
                },
            },
        ]

        expect(
            checkReorder(
                dense,
                "c",
                { x: -150, y: 100 },
                { x: -1, y: 1 },
                "xy"
            ).map(({ value }) => value)
        ).toEqual(["a", "c", "b"])
    })

    test("preserves single-axis reorder thresholds", () => {
        const horizontal = grid.slice(0, 2)

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
