import { createPathSolver, createRing } from "../solver"

type P = { x: number; y: number }

const ring = (points: P[], closed = true) =>
    createRing(
        points.flatMap(({ x, y }) => [x, y]),
        closed
    )

const box = (x: number, y: number, width: number, height: number) =>
    ring([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
    ])

// The other way round, so it's a hole in a box by the nonzero rule
const hole = (x: number, y: number, width: number, height: number) =>
    ring([
        { x, y },
        { x, y: y + height },
        { x: x + width, y: y + height },
        { x: x + width, y },
    ])

function expectPoint({ x, y }: P, expected: P) {
    expect(x).toBeCloseTo(expected.x, 5)
    expect(y).toBeCloseTo(expected.y, 5)
}

describe("createPathSolver: area", () => {
    // A room with a 40px square pillar at x 0 to 40, y 0 to 40
    const room = () => [box(-100, -100, 300, 300), hole(0, 0, 40, 40)]

    test("a pointer behind a pillar holds the element in front of it", () => {
        const solve = createPathSolver(room(), { x: -20, y: 20 }, false, 20)

        expectPoint(solve({ x: 60, y: 20 }), { x: 0, y: 20 })
    })

    test("a pointer past a pillar's corner draws the element round it", () => {
        const solve = createPathSolver(room(), { x: -20, y: 20 }, false, 20)

        expectPoint(solve({ x: 60, y: 20 }), { x: 0, y: 20 })
        // Just behind the top corner: within forgiveness of the front
        expectPoint(solve({ x: 50, y: 5 }), { x: 50, y: 5 })
    })

    test("pulls in an element that starts outside the area", () => {
        const solve = createPathSolver(
            [box(0, 0, 100, 100)],
            { x: -50, y: 50 },
            false,
            20
        )

        expectPoint(solve({ x: -40, y: 50 }), { x: 0, y: 50 })
        expectPoint(solve({ x: 50, y: 50 }), { x: 50, y: 50 })
    })

    test("an element resting on an edge can't leave through it", () => {
        const solve = createPathSolver(
            [box(0, 0, 100, 100)],
            { x: 100, y: 50 },
            false,
            20
        )

        expectPoint(solve({ x: 150, y: 50 }), { x: 100, y: 50 })
        expectPoint(solve({ x: 150, y: 60 }), { x: 100, y: 60 })
        expectPoint(solve({ x: 90, y: 60 }), { x: 90, y: 60 })
    })

    test("leaves an edge for a pointer back inside, until something's in the way", () => {
        const solve = createPathSolver(room(), { x: -100, y: 20 }, false, 20)

        // Resting on the room's left wall, the pillar is between it and the pointer
        expectPoint(solve({ x: -120, y: 20 }), { x: -100, y: 20 })
        expectPoint(solve({ x: 20, y: 20 }), { x: 0, y: 20 })
    })
})

describe("createPathSolver: stroke", () => {
    test("stays on its own subpath", () => {
        const solve = createPathSolver(
            [
                ring(
                    [
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                    ],
                    false
                ),
                ring(
                    [
                        { x: 0, y: 10 },
                        { x: 100, y: 10 },
                    ],
                    false
                ),
            ],
            { x: 0, y: 0 },
            true,
            20
        )

        expectPoint(solve({ x: 50, y: 30 }), { x: 50, y: 0 })
    })

    test("snaps an element that starts off the line onto it", () => {
        const solve = createPathSolver(
            [
                ring(
                    [
                        { x: 0, y: 0 },
                        { x: 100, y: 0 },
                    ],
                    false
                ),
            ],
            { x: 50, y: 50 },
            true,
            20
        )

        expectPoint(solve({ x: 50, y: 50 }), { x: 50, y: 0 })
    })

    test("crosses where a closed path's ends join", () => {
        const solve = createPathSolver(
            [box(0, 0, 100, 100)],
            { x: 10, y: 0 },
            true,
            20
        )

        expectPoint(solve({ x: -10, y: 10 }), { x: 0, y: 10 })
    })
})
