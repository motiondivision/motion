import { drag, DragOptions } from ".."
import type { InertiaOptions } from "../../../animation/types"
import type {
    DragConstraintsContext,
    DragConstraintsFunction,
    DragPointConstraint,
} from "../types"
import {
    createElement,
    deferred,
    gesture,
    getValue,
    nextFrame,
    Point,
    values,
} from "./utils"

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

/**
 * A constraint that holds the element on the line y = x, and records what
 * drag gives it.
 */
function diagonal() {
    const calls = {
        contexts: [] as DragConstraintsContext[],
        moves: [] as Point[],
        releases: [] as Array<[Point, InertiaOptions]>,
    }
    const release = deferred()

    const constraints: DragConstraintsFunction = (context) => {
        calls.contexts.push(context)
        const x = context.getAxisMotionValue("x")
        const y = context.getAxisMotionValue("y")

        const point: DragPointConstraint = {
            ...context.originPoint,
            move() {
                calls.moves.push({ x: point.x, y: point.y })
                const along = (point.x + point.y) / 2
                x.set(along)
                y.set(along)
            },
            release(velocity, transition) {
                calls.releases.push([velocity, transition])
                return release.promise
            },
        }

        return point
    }

    return { constraints, calls, release }
}

describe("drag: a constraints function", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("is called when the drag starts, with the drag's origin, elastic and values", async () => {
        const { constraints, calls } = diagonal()
        makeDraggable(element, { constraints, elastic: 0.2 })

        const pointer = gesture(element)
        await pointer.to(20, 0)

        expect(calls.contexts).toHaveLength(1)
        const [context] = calls.contexts
        expect(context.originPoint).toEqual({ x: 0, y: 0 })
        expect(context.elastic.x).toEqual({ min: 0.2, max: 0.2 })
        expect(context.getAxisMotionValue("x")).toBe(getValue(element, "x"))
        expect(context.visualElement.current).toBe(element)
        pointer.end()
    })

    test("moves the element itself, from the pointer's position", async () => {
        const { constraints, calls } = diagonal()
        makeDraggable(element, { constraints, momentum: false })

        const pointer = gesture(element)
        await pointer.to(30, 10)

        expect(calls.moves[calls.moves.length - 1]).toEqual({ x: 30, y: 10 })
        expect(values(element)).toEqual({ x: 20, y: 20 })
        pointer.end()
    })

    test("is called again for each drag", async () => {
        const { constraints, calls } = diagonal()
        makeDraggable(element, { constraints, momentum: false })

        const first = gesture(element)
        await first.to(30, 10)
        first.end()
        await nextFrame()

        const second = gesture(element)
        await second.to(10, 10)
        second.end()

        expect(calls.contexts).toHaveLength(2)
        expect(calls.contexts[1].originPoint).toEqual({ x: 20, y: 20 })
    })

    test("hands the release to the constraint, then fires onTransitionEnd", async () => {
        const { constraints, calls, release } = diagonal()
        const onTransitionEnd = jest.fn()
        makeDraggable(element, {
            constraints,
            elastic: 0.5,
            transition: { power: 0.3 },
            onTransitionEnd,
        })

        const pointer = gesture(element)
        await pointer.to(10, 0)
        await pointer.to(30, 0)
        pointer.end()
        await nextFrame()

        expect(calls.releases).toHaveLength(1)
        const [velocity, transition] = calls.releases[0]
        expect(velocity.x).toBeGreaterThan(0)
        expect(velocity.y).toBe(0)
        expect(transition).toMatchObject({
            power: 0.3,
            timeConstant: 750,
            bounceStiffness: 200,
            bounceDamping: 40,
        })

        expect(onTransitionEnd).not.toHaveBeenCalled()
        release.resolve()
        await nextFrame()
        expect(onTransitionEnd).toHaveBeenCalledTimes(1)
    })

    test("release velocity is only along drag axes, and nothing without momentum", async () => {
        const along = diagonal()
        makeDraggable(element, { constraints: along.constraints, axis: "x" })

        let pointer = gesture(element)
        await pointer.to(10, 10)
        await pointer.to(30, 30)
        pointer.end()
        await nextFrame()

        expect(along.calls.releases[0][0].x).toBeGreaterThan(0)
        expect(along.calls.releases[0][0].y).toBe(0)

        const still = diagonal()
        const other = createElement()
        makeDraggable(other, {
            constraints: still.constraints,
            momentum: false,
        })

        pointer = gesture(other)
        await pointer.to(10, 10)
        await pointer.to(30, 30)
        pointer.end(other)
        await nextFrame()

        expect(still.calls.releases[0][0]).toEqual({ x: 0, y: 0 })
    })

    test("snapToOrigin animates back to the origin rather than releasing", async () => {
        const { constraints, calls } = diagonal()
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            constraints,
            snapToOrigin: true,
            transition: { bounceStiffness: 1000, bounceDamping: 100 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = gesture(element)
        await pointer.to(30, 10)
        pointer.end()

        await onTransitionEnd.promise
        expect(calls.releases).toHaveLength(0)
        expect(values(element)).toEqual({ x: 0, y: 0 })
    })
})
