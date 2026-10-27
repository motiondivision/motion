import { MotionGlobalConfig } from "motion-utils"
import { drag, DragOptions } from ".."
import { motionValue } from "../../../value"
import type { VisualElementDragControls } from "../VisualElementDragControls"
import { pathConstraints } from "../path"
import {
    createElement,
    deferred,
    gesture,
    getValue,
    nextFrame,
    sleep,
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
        // The hole runs the same way round as the square
        path.style.fillRule = "evenodd"

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

describe("drag path constraints: fill rule", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("overlapping subpaths fill one area, as SVG's default nonzero rule draws them", async () => {
        // A plus of two rects that run the same way round
        makeDraggable(element, {
            constraints: pathConstraints(
                "M-10 -50h20v100h-20z M-50 -10h100v20H-50z"
            ),
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [3, 3],
            // From the centre, up the top arm
            [0, -40],
        ])
        expectPoint(element, 0, -40)

        // Back down to the centre, where they overlap, and out along the
        // left arm
        await pointer.to(0, 0)
        expectPoint(element, 0, 0)
        await pointer.to(-40, 0)
        expectPoint(element, -40, 0)
    })

    test("doesn't stop where subpaths overlap, short of the edge", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                "M-10 -50h20v100h-20z M-50 -10h100v20H-50z"
            ),
            elastic: false,
            momentum: false,
        })

        // Against the top arm's right side
        const pointer = await dragThrough(element, [
            [0, -5],
            [0, -30],
            [30, -30],
        ])
        expectPoint(element, 10, -30)

        // Down that side, which is within the right arm from y -10
        await pointer.to(60, 5)
        expectPoint(element, 50, 5)
    })

    test("a subpath that runs the other way round is a hole", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                "M-50 -50H50V50H-50Z M10 -20V20H30V-20Z"
            ),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [40, 0],
        ])
        expectPoint(element, 10, 0)
    })

    test("an inner subpath that runs the same way round is filled", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                "M-50 -50H50V50H-50Z M10 -20H30V20H10Z"
            ),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [40, 0],
        ])
        expectPoint(element, 40, 0)
    })

    test("fillRule: evenodd makes any inner subpath a hole", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(
                "M-50 -50H50V50H-50Z M10 -20H30V20H10Z",
                { fillRule: "evenodd" }
            ),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [40, 0],
        ])
        expectPoint(element, 10, 0)
    })
})

describe("drag path constraints: elastic across walls", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("elastic doesn't draw the element across a thin wall", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            // The default elastic
            momentum: false,
        })

        await dragThrough(element, [
            [2, 2],
            [50, 80],
        ])

        // Held at the wall's near side (y 10). Its far side is at y 20.
        const { y } = values(element)
        expect(y).toBeGreaterThan(10)
        expect(y).toBeLessThan(20)
    })

    test("elastic doesn't draw the element onto another part of a stroke", async () => {
        makeDraggable(element, {
            // A hairpin: out along y 0 and back along y 20
            constraints: pathConstraints(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 20 },
                    { x: 0, y: 20 },
                ],
                { stroke: true }
            ),
            elastic: 0.8,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 0],
            [50, 0],
            [50, 60],
        ])

        const { y } = values(element)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(20)
    })
})

describe("drag path constraints: catching up", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    /**
     * Held against the wall (y 10) with the pointer behind it, then the
     * pointer moves along, 2px a frame, past the wall's end, where the
     * element can see it. Returns the furthest it moved in a frame.
     */
    async function aroundTheWall() {
        const pointer = await dragThrough(element, [
            [2, 2],
            [50, 30],
        ])
        let last = values(element)
        let furthest = 0
        for (let x = 52; x <= 110; x += 2) {
            await pointer.to(x, 30)
            const point = values(element)
            furthest = Math.max(
                furthest,
                Math.hypot(point.x - last.x, point.y - last.y)
            )
            last = point
        }
        return { pointer, furthest }
    }

    test("with elastic, the element eases to the pointer once nothing blocks it", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: 0.5,
            momentum: false,
        })

        const { pointer, furthest } = await aroundTheWall()
        expect(furthest).toBeLessThan(6)

        await sleep(300)
        expectPoint(element, 110, 30)

        // Then follows the pointer as usual
        await pointer.to(115, 35)
        expectPoint(element, 115, 35)
        pointer.end()
    })

    test("without elastic, the element goes straight to the pointer", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: false,
            momentum: false,
        })

        const { pointer, furthest } = await aroundTheWall()
        expect(furthest).toBeGreaterThan(6)
        expectPoint(element, 110, 30)
        pointer.end()
    })

    test("leaving an edge for the pointer doesn't lag behind it", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: 0.5,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [70, 0],
            [40, 0],
        ])
        expectPoint(element, 40, 0)
        await pointer.to(10, 0)
        expectPoint(element, 10, 0)
        pointer.end()
    })
})

describe("drag path constraints: between gestures", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("grabbing the element as it springs back keeps it on its side of a wall", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(corridors),
            elastic: 0.5,
            momentum: false,
        })

        // Held at the wall (y 10), drawn toward the pointer
        const first = await dragThrough(element, [
            [2, 2],
            [50, 18],
        ])
        expectPoint(element, 50, 14)
        first.end()
        await nextFrame()

        // Grab it again before it's back, and pull it further down
        const second = await dragThrough(element, [
            [0, 4],
            [0, 30],
        ])
        const { y } = values(element)
        expect(y).toBeGreaterThan(10)
        expect(y).toBeLessThan(20)
        second.end()
    })

    test("grabbing the element as it springs back keeps it on its part of a stroke", async () => {
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
            elastic: 0.5,
            momentum: false,
        })

        const first = await dragThrough(element, [
            [5, 0],
            [50, 0],
            [50, 16],
        ])
        expectPoint(element, 50, 8)
        first.end()
        await nextFrame()

        // Straight back up to the top line, which it never left
        const second = await dragThrough(element, [
            [0, 4],
            [0, -8],
        ])
        expect(values(element).y).toBeCloseTo(0, 0)
        second.end()
    })

    test("a tap doesn't animate the element back to where it was dragged", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            momentum: false,
        })

        const first = await dragThrough(element, [
            [5, 5],
            [30, 30],
        ])
        first.end()
        await nextFrame()

        // Moved elsewhere, as by a reset button
        getValue(element, "x")!.set(0)
        getValue(element, "y")!.set(0)

        gesture(element).end()
        await sleep(100)

        expectPoint(element, 0, 0)
    })

    test("a new drag after the element is moved elsewhere starts from there", async () => {
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            momentum: false,
        })

        const first = await dragThrough(element, [
            [5, 5],
            [30, 30],
        ])
        first.end()
        await nextFrame()

        getValue(element, "x")!.set(-20)
        getValue(element, "y")!.set(0)

        const second = await dragThrough(element, [
            [0, 5],
            [0, 10],
        ])
        expectPoint(element, -20, 10)
        second.end()
    })
})

describe("drag path constraints: axes", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("momentum only glides along a locked direction", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            directionLock: true,
            transition: { timeConstant: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        // Locks to x, then drifts down
        const pointer = await dragThrough(element, [
            [12, 0],
            [20, 6],
            [28, 12],
        ])
        expectPoint(element, 28, 0)
        pointer.end()

        await onTransitionEnd.promise
        expect(values(element).y).toBeCloseTo(0, 1)
    })

    test("snapping one axis to its origin doesn't glide the other off the path", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints: pathConstraints(square),
            elastic: false,
            snapToOrigin: "x",
            transition: { timeConstant: 200 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await dragThrough(element, [
            [0, 10],
            [0, 45],
        ])
        pointer.end()

        await onTransitionEnd.promise
        expect(values(element).y).toBeLessThanOrEqual(50)
    })
})

describe("drag path constraints: edge cases", () => {
    let element: HTMLElement
    let warn: jest.SpyInstance

    beforeEach(() => {
        element = createElement()
        warn = jest.spyOn(console, "warn").mockImplementation(() => {})
    })

    afterEach(() => warn.mockRestore())

    test.each([
        ["empty path data", () => pathConstraints("")],
        ["path data with no lines", () => pathConstraints("M10 10")],
        ["a single point", () => pathConstraints([{ x: 10, y: 10 }])],
        [
            "a path with no data",
            () => pathConstraints(svgElement("path", [square], { x: 0, y: 0 })),
        ],
        ["a ref to nothing", () => pathConstraints({ current: null })],
    ])("%s holds the element where it is", async (_, constraints) => {
        const target = constraints()
        document.querySelector("path")?.removeAttribute("d")

        const errors: unknown[] = []
        const onError = (event: ErrorEvent) => errors.push(event.error)
        window.addEventListener("error", onError)

        makeDraggable(element, {
            constraints: target,
            elastic: false,
            momentum: false,
        })

        const pointer = await dragThrough(element, [
            [5, 5],
            [30, 30],
        ])
        pointer.end()
        await nextFrame()
        window.removeEventListener("error", onError)

        expect(errors).toEqual([])
        expectPoint(element, 0, 0)
    })

    test("a shape with no length holds the element on its point", async () => {
        const shape = svgElement("circle", [[{ x: 0, y: 0 }]])
        const getPointAtLength = shape.getPointAtLength
        shape.getPointAtLength = (distance: number) => {
            if (!Number.isFinite(distance)) throw new TypeError("non-finite")
            return getPointAtLength.call(shape, distance)
        }

        makeDraggable(element, {
            constraints: pathConstraints(shape, { stroke: true }),
            elastic: false,
            momentum: false,
        })

        await dragThrough(element, [
            [5, 5],
            [30, 30],
        ])
        expectPoint(element, 0, 0)
    })

    test("skipAnimations ends the release at once", async () => {
        MotionGlobalConfig.skipAnimations = true
        const onTransitionEnd = deferred()

        try {
            makeDraggable(element, {
                constraints: pathConstraints(square),
                elastic: 0.5,
                onTransitionEnd: () => onTransitionEnd.resolve(),
            })

            const pointer = await dragThrough(element, [
                [5, 5],
                [70, 10],
            ])
            pointer.end()

            await onTransitionEnd.promise
            expectPoint(element, 50, 10)
        } finally {
            MotionGlobalConfig.skipAnimations = false
        }
    })
})

describe("drag path constraints: layout changes", () => {
    test("a layout change mid-drag keeps the path where it's drawn", () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const controls = {
            visualElement: { getTransformPagePoint: () => undefined },
            originPoint: { x: 0, y: 0 },
            elastic: {
                x: { min: 0, max: 0 },
                y: { min: 0, max: 0 },
            },
            getAxisMotionValue: (axis: string) => (axis === "x" ? x : y),
        } as unknown as VisualElementDragControls

        const constraint = pathConstraints(square)(controls)
        constraint.x = 60
        constraint.y = 0
        constraint.move()
        expect(x.get()).toBe(50)

        /**
         * The element's layout moves 10px left. Drag shifts its origin and
         * `x` 10px right, so it stays where it's drawn, and so does the
         * path's right edge.
         */
        controls.originPoint.x += 10
        x.set(x.get() + 10)

        // The pointer hasn't moved: in `x` space, it's 10px further on
        constraint.x = 70
        constraint.move()
        expect(x.get()).toBe(60)
    })

    test("a release straight after a layout change springs back to the path", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const controls = {
            visualElement: {
                getTransformPagePoint: () => undefined,
                getValue: () => undefined,
            },
            originPoint: { x: 0, y: 0 },
            elastic: {
                x: { min: 0.5, max: 0.5 },
                y: { min: 0.5, max: 0.5 },
            },
            getAxisMotionValue: (axis: string) => (axis === "x" ? x : y),
        } as unknown as VisualElementDragControls

        const constraint = pathConstraints(square)(controls)
        constraint.x = 90
        constraint.y = 0
        constraint.move()
        expect(x.get()).toBe(70)

        // The layout moves 10px left before the pointer moves again
        controls.originPoint.x += 10
        x.set(x.get() + 10)

        await constraint.release(
            { x: 0, y: 0 },
            {
                timeConstant: 750,
                restDelta: 1,
                bounceStiffness: 200,
                bounceDamping: 40,
            }
        )
        expect(x.get()).toBeCloseTo(60, 0)
    })
})
