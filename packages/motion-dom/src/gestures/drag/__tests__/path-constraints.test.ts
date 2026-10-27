import { drag, DragOptions } from ".."
import { pathConstraints } from "../path"
import {
    createElement,
    deferred,
    gesture,
    getValue,
    nextFrame,
    values,
} from "./utils"

type P = { x: number; y: number }

let stops: VoidFunction[] = []

function makeDraggable(element: Element, options: DragOptions) {
    const stop = drag(element, options)
    stops.push(stop)
    return stop
}

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

function expectPoint(element: Element, x: number, y: number) {
    const point = values(element)
    expect(point.x).toBeCloseTo(x, 1)
    expect(point.y).toBeCloseTo(y, 1)
}

/**
 * Drag through each pointer position, measured from the press.
 */
async function dragThrough(element: Element, points: Array<[number, number]>) {
    const pointer = gesture(element)
    for (const [x, y] of points) await pointer.to(x, y)
    return pointer
}

/**
 * An SVG element whose outline runs through `rings`, in a viewport offset
 * by `offset` from the draggable's origin (which JSDOM puts at 0, 0).
 *
 * A `<path>` is read from its path data. JSDOM has no SVG geometry, so
 * other shapes, which are measured with `getPointAtLength()`, fake it.
 */
function svgElement(tag: string, rings: P[][], offset: P = { x: 0, y: 0 }) {
    const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tag
    ) as any

    if (tag === "path") {
        element.setAttribute(
            "d",
            rings
                .map(
                    (ring) =>
                        "M" +
                        ring.map(({ x, y }) => x + " " + y).join(" L") +
                        " Z"
                )
                .join(" ")
        )
    } else {
        const segments: Array<[P, P, number]> = []
        let total = 0
        const points = [...rings[0], rings[0][0]]
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i]
            const b = points[i + 1]
            const length = Math.hypot(b.x - a.x, b.y - a.y)
            segments.push([a, b, length])
            total += length
        }

        element.getTotalLength = () => total
        element.getPointAtLength = (distance: number) => {
            for (const [a, b, length] of segments) {
                if (distance <= length) {
                    const t = length ? distance / length : 0
                    return {
                        x: a.x + (b.x - a.x) * t,
                        y: a.y + (b.y - a.y) * t,
                    }
                }
                distance -= length
            }
            return { ...segments[segments.length - 1][1] }
        }
    }

    element.getScreenCTM = () => ({
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: offset.x,
        f: offset.y,
    })
    document.body.appendChild(element)
    return element as SVGGeometryElement
}

const square: P[] = [
    { x: -50, y: -50 },
    { x: 50, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
]

/**
 * Two corridors, A (y -10 to 10) and B (y 20 to 40), split by a wall from
 * x -10 to 100 and joined beyond it at x 100 to 120.
 */
const corridors: P[] = [
    { x: -10, y: -10 },
    { x: 120, y: -10 },
    { x: 120, y: 40 },
    { x: -10, y: 40 },
    { x: -10, y: 20 },
    { x: 100, y: 20 },
    { x: 100, y: 10 },
    { x: -10, y: 10 },
]

/**
 * An L: a column (x -50 to 10) and a row along its bottom (y 10 to 50), with
 * the notch between them (x > 10, y < 10) outside the area.
 */
const lShape: P[] = [
    { x: -50, y: -60 },
    { x: 10, y: -60 },
    { x: 10, y: 10 },
    { x: 60, y: 10 },
    { x: 60, y: 50 },
    { x: -50, y: 50 },
]

describe("drag path constraints: area", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("follows the pointer within the area", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [20, 30],
        ])

        expectPoint(element, 20, 30)
    })

    test("stops at the edge of the area", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [100, 20],
        ])
        expectPoint(element, 50, 20)
    })

    test("slides along the edge and into a corner", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [100, 20],
            [100, 40],
        ])
        expectPoint(element, 50, 40)

        await pointer.to(100, 100)
        expectPoint(element, 50, 50)

        await pointer.to(-20, 100)
        expectPoint(element, -20, 50)
    })

    test("doesn't jump across a thin wall", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [2, 2],
            [0, 30],
        ])
        expectPoint(element, 0, 10)

        await pointer.to(50, 30)
        expectPoint(element, 50, 10)
    })

    test("doesn't jump across a thin wall in a single fast move", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [80, 35],
        ])

        expect(values(element).y).toBeLessThanOrEqual(10)
    })

    test("goes around the end of a wall when the pointer does", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [2, 2],
            [50, 30],
        ])
        expectPoint(element, 50, 10)

        await pointer.to(110, 0)
        expectPoint(element, 110, 0)

        await pointer.to(110, 30)
        await pointer.to(50, 30)
        expectPoint(element, 50, 30)

        // Now in corridor B, it's held on that side of the wall
        await pointer.to(50, 0)
        expectPoint(element, 50, 20)
    })

    test("rounds an inner corner when the pointer is out of sight", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(lShape),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            // Into the row, out of sight around the corner at 10, 10
            [40, 30],
        ])

        expectPoint(element, 40, 30)
    })

    test("is forgiving around corners", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(lShape),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [2, 2],
            // In the notch, nearest the column's right edge
            [20, -40],
        ])
        expectPoint(element, 10, -40)

        // Around the corner, nearest the row's top edge
        await pointer.to(50, 0)
        expectPoint(element, 50, 10)
    })

    test("forgiveness: 0 holds the element at the nearest point it can slide to", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(lShape, { forgiveness: 0 }),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [2, 2],
            [20, -40],
        ])
        await pointer.to(50, 0)

        expectPoint(element, 10, 0)
    })

    test("supports holes and doesn't pass through them", async () => {
        const path = svgElement("path", [
            square,
            [
                { x: 10, y: -20 },
                { x: 30, y: -20 },
                { x: 30, y: 20 },
                { x: 10, y: 20 },
            ],
        ])

        makeDraggable(element, {
            constraints: pathConstraints(path),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [2, 2],
            // Behind the hole
            [40, 0],
        ])
        expectPoint(element, 10, 0)

        // Inside the hole
        await pointer.to(20, 5)
        expectPoint(element, 10, 5)
    })

    test("measures an element's outline relative to the draggable", async () => {
        // The square's viewport position is 100px right of the draggable
        const path = svgElement("path", [square], { x: 100, y: 0 })

        makeDraggable(element, {
            constraints: pathConstraints(path),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [0, 0],
        ])
        expectPoint(element, 50, 0)
    })

    test("measures other shapes along their outline", async () => {
        const shape = svgElement("polygon", [square], { x: 100, y: 0 })

        makeDraggable(element, {
            constraints: pathConstraints(shape),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [0, 10],
        ])
        expectPoint(element, 50, 10)
    })

    test("accepts a ref to an element", async () => {
        const path = svgElement("path", [square])

        makeDraggable(element, {
            constraints: pathConstraints({ current: path }),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [100, 0],
        ])
        expectPoint(element, 50, 0)
    })

    test("applies elastic beyond the edge", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: 0.5,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [70, 10],
        ])

        expectPoint(element, 60, 10)
    })

    test("applies per-edge elastic", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: { right: 0.5, bottom: 0 },
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [70, 70],
        ])

        expectPoint(element, 60, 50)
    })

    test("springs back inside on release", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: 0.5,
            momentum: false,
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [70, 10],
        ])
        pointer.end()

        await onTransitionEnd.promise
        expectPoint(element, 50, 10)
    })

    test("momentum glides within the area", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            transition: { timeConstant: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await dragThrough(element, [
            [1, 1],
            [20, 1],
        ])
        pointer.end()

        await onTransitionEnd.promise
        const { x, y } = values(element)
        expect(x).toBeGreaterThan(20)
        expect(x).toBeLessThanOrEqual(50)
        expect(y).toBeGreaterThanOrEqual(-50)
        expect(y).toBeLessThanOrEqual(50)
    })

    test("momentum doesn't carry the element across a wall", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: false,
            transition: { timeConstant: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await dragThrough(element, [
            [1, 1],
            [1, 8],
        ])
        pointer.end()

        await onTransitionEnd.promise
        expect(values(element).y).toBeLessThanOrEqual(10)
    })

    test("momentum stops against an edge, rather than rounding a corner", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(lShape),
            elastic: false,
            transition: { timeConstant: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        // Thrown at the column's right edge, 10px above the corner into the row
        const pointer = await dragThrough(element, [
            [1, 0],
            [9, 0],
        ])
        pointer.end()

        await onTransitionEnd.promise
        expectPoint(element, 10, 0)
    })

    test("momentum slides along an edge it's thrown into", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            transition: { timeConstant: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await dragThrough(element, [
            [1, 1],
            [40, 11],
        ])
        pointer.end()

        await onTransitionEnd.promise
        const { x, y } = values(element)
        expect(x).toBeCloseTo(50, 1)
        expect(y).toBeGreaterThan(11)
        expect(y).toBeLessThanOrEqual(50)
    })

    test("pressing during the release animation stops it", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: 0.5,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [90, 10],
        ])
        pointer.end()

        const x = getValue(element, "x")!
        expect(x.isAnimating()).toBe(true)

        gesture(element)
        await nextFrame()
        expect(x.isAnimating()).toBe(false)
    })
})

describe("drag path constraints: stroke", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("holds the element on the line nearest the pointer", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                ],
                { stroke: true }
            ),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [50, 30],
        ])
        expectPoint(element, 50, 0)

        await pointer.to(150, 10)
        expectPoint(element, 100, 0)

        await pointer.to(-20, 0)
        expectPoint(element, 0, 0)
    })

    test("doesn't jump to a nearer part of the line across a gap", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 20 },
                    { x: 0, y: 20 },
                ],
                { stroke: true }
            ),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [50, 25],
        ])
        expectPoint(element, 50, 0)

        // Round the bend, then back along the far side
        await pointer.to(110, 25)
        expectPoint(element, 100, 20)

        await pointer.to(50, 25)
        expectPoint(element, 50, 20)
    })

    test("is forgiving around corners", async () => {
        const line = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ]
        makeDraggable(element, {
            constraints: pathConstraints(line, { stroke: true }),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [90, 5],
            // Cut inside the corner
            [90, 15],
        ])

        expectPoint(element, 100, 15)
        pointer.end()
    })

    test("forgiveness: 0 follows only a downhill slide", async () => {
        const line = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ]
        makeDraggable(element, {
            constraints: pathConstraints(line, {
                stroke: true,
                forgiveness: 0,
            }),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [90, 5],
            [90, 15],
        ])

        expectPoint(element, 90, 0)
    })

    test("follows a closed path all the way round", async () => {
        const path = svgElement("polygon", [square])

        makeDraggable(element, {
            constraints: pathConstraints(path, { stroke: true }),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, -60],
            [60, -60],
            [60, 60],
            [-60, 60],
            [-60, -60],
            [0, -60],
        ])

        expectPoint(element, 0, -50)
        pointer.end()
    })

    test("applies elastic off the line", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                ],
                { stroke: true }
            ),
            elastic: 0.5,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [50, 30],
        ])

        expectPoint(element, 50, 15)
    })
})
