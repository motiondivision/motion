import { drag, DragOptions } from ".."
import { magnetic, MagneticOptions } from "../magnetic"
import {
    createElement,
    deferred,
    gesture,
    nextFrame,
    sleep,
    values,
} from "./utils"

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

/**
 * JSDOM has no layout, so place each element with a fixed box. The
 * dragged element's box follows its `x`/`y`, as a transform would.
 */
function place(element: Element, left: number, top: number, size = 50) {
    element.getBoundingClientRect = () => {
        const { x, y } = values(element)
        return {
            left: left + x,
            top: top + y,
            width: size,
            height: size,
        } as DOMRect
    }
}

const instant = { duration: 0 }

function setup(
    magnetOptions: MagneticOptions = {},
    dragOptions: DragOptions = {}
) {
    const element = createElement()
    place(element, 0, 0)

    const right = createElement()
    right.className = "slot"
    place(right, 100, 0)

    const below = createElement()
    below.className = "slot"
    place(below, 0, 300)

    stops.push(
        drag(element, {
            momentum: false,
            ...dragOptions,
            constraints: magnetic([right, below], {
                transition: instant,
                ...magnetOptions,
            }),
        })
    )

    return { element, right, below }
}

describe("magnetic", () => {
    test("pulls the element towards a target inside the radius", async () => {
        const { element } = setup({ radius: 100, pull: 1 })

        const pointer = gesture(element)
        await pointer.to(60, 0)

        // 40px away: pull 1 * (1 - 40 / 100) ^ 2 = 0.36 of the way
        expect(values(element).x).toBeCloseTo(60 + 40 * 0.36)
        expect(values(element).y).toBe(0)
        pointer.end()
    })

    test("doesn't pull from outside the radius", async () => {
        const { element } = setup({ radius: 100, pull: 1 })

        const pointer = gesture(element)
        await pointer.to(-20, 150)

        expect(values(element)).toEqual({ x: -20, y: 150 })
        pointer.end()
    })

    test("locks onto a target inside the snap distance", async () => {
        const { element } = setup({ snap: 30, pull: 0 })

        const pointer = gesture(element)
        await pointer.to(80, 10)
        await nextFrame()

        expect(values(element)).toEqual({ x: 100, y: 0 })

        // And lets go once the pointer moves out of it
        await pointer.to(40, 10)
        await nextFrame()

        expect(values(element)).toEqual({ x: 40, y: 10 })
        pointer.end()
    })

    test("blends onto the target rather than jumping", async () => {
        const { element } = setup({
            snap: 30,
            pull: 0,
            transition: { duration: 0.2, ease: "linear" },
        })

        const pointer = gesture(element)
        await pointer.to(50, 0)
        expect(values(element).x).toBe(50)

        await pointer.to(80, 0)
        const x = values(element).x
        expect(x).toBeGreaterThanOrEqual(50)
        expect(x).toBeLessThan(100)

        await sleep(300)
        expect(values(element).x).toBe(100)
        pointer.end()
    })

    test("reports the target that holds the element", async () => {
        const onChange = jest.fn()
        const { element, right } = setup({ snap: 30, onChange })

        const pointer = gesture(element)
        await pointer.to(50, 0)
        expect(onChange).not.toHaveBeenCalled()

        await pointer.to(90, 0)
        expect(onChange).toHaveBeenLastCalledWith(right)

        await pointer.to(0, 0)
        expect(onChange).toHaveBeenLastCalledWith(null)
        pointer.end()
    })

    test("settles on the nearest target on release", async () => {
        const transitionEnd = deferred()
        const { element } = setup(
            { pull: 0 },
            { onTransitionEnd: () => transitionEnd.resolve() }
        )

        const pointer = gesture(element)
        await pointer.to(30, 220)
        pointer.end()
        await transitionEnd.promise

        expect(values(element)).toEqual({ x: 0, y: 300 })
    })

    test("stays put on release away from every target", async () => {
        const transitionEnd = deferred()
        const { element } = setup(
            { pull: 0 },
            { onTransitionEnd: () => transitionEnd.resolve() }
        )

        const pointer = gesture(element)
        await pointer.to(-150, -150)
        pointer.end()
        await transitionEnd.promise

        expect(values(element)).toEqual({ x: -150, y: -150 })
    })

    test("only moves the axes drag moves", async () => {
        const element = createElement()
        place(element, 0, 0)
        const target = createElement()
        place(target, 100, 40)

        stops.push(
            drag(element, {
                axis: "x",
                momentum: false,
                constraints: magnetic(target, {
                    snap: 30,
                    transition: instant,
                }),
            })
        )

        const pointer = gesture(element)
        await pointer.to(90, 0)
        await nextFrame()

        // The target is 40px below, but only x is dragged.
        expect(values(element)).toEqual({ x: 100, y: 0 })
        pointer.end()
    })

    test("accepts selectors and refs, and skips the dragged element", async () => {
        const element = createElement()
        element.className = "slot"
        place(element, 0, 0)
        const slot = createElement()
        slot.className = "slot"
        place(slot, 100, 0)
        const refTarget = createElement()
        place(refTarget, 0, 100)

        const onChange = jest.fn()
        stops.push(
            drag(element, {
                momentum: false,
                constraints: magnetic([".slot", { current: refTarget }], {
                    snap: 20,
                    transition: instant,
                    onChange,
                }),
            })
        )

        const pointer = gesture(element)
        await pointer.to(5, 5)
        expect(onChange).not.toHaveBeenCalled()

        await pointer.to(95, 0)
        expect(onChange).toHaveBeenLastCalledWith(slot)

        await pointer.to(0, 95)
        expect(onChange).toHaveBeenLastCalledWith(refTarget)
        pointer.end()
    })
})
