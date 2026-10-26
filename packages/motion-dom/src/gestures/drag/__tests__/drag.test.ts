import { MotionGlobalConfig } from "motion-utils"
import { scopeMotion } from "../../../scope"
import { delay } from "../../../utils/delay"
import { drag, DragOptions } from ".."
import { animateElement } from "../../../animation/animate/element"
import { visualElementStore } from "../../../render/store"
import { MotionValue } from "../../../value"
import { transformProps } from "../../../render/utils/keys-transform"
import { acceleratedValues } from "../../../animation/waapi/utils/accelerated-values"
import {
    createElement,
    deferred,
    gesture,
    getValue,
    nextFrame,
    Point,
    pointer,
    sleep,
    values,
} from "./utils"

async function dragTo(element: Element, x: number, y: number) {
    pointer(element, "pointerdown")
    await nextFrame()
    pointer(window, "pointermove", x, y)
    await nextFrame()
}

async function release(element: Element, x = 0, y = 0) {
    pointer(element, "pointerup", x, y)
    await nextFrame()
}

let stops: VoidFunction[] = []

/**
 * drag(), with the returned cleanup run after each test so a failing
 * test can't leave a gesture (or the global drag lock) behind.
 */
function makeDraggable(
    element: Parameters<typeof drag>[0],
    options?: DragOptions
) {
    const stop = drag(element, options)
    stops.push(stop)
    return stop
}

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

describe("drag", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    test("moves the element with the pointer", async () => {
        makeDraggable(element, { momentum: false })

        await dragTo(element, 100, 50)

        expect(element.style.transform).toBe(
            "translateX(100px) translateY(50px)"
        )

        await release(element)
    })

    test("locks to an axis", async () => {
        makeDraggable(element, { axis: "x", momentum: false })

        await dragTo(element, 100, 50)

        expect(element.style.transform).toBe("translateX(100px)")

        await release(element)
    })

    test("applies pixel constraints", async () => {
        makeDraggable(element, {
            constraints: { left: 0, right: 50 },
            elastic: 0,
            momentum: false,
        })

        await dragTo(element, 100, 0)

        expect(values(element).x).toBe(50)

        await release(element)
    })

    test("fires lifecycle callbacks", async () => {
        const onStart = jest.fn()
        const onMove = jest.fn()
        const onEnd = jest.fn()

        makeDraggable(element, { momentum: false, onStart, onMove, onEnd })

        await dragTo(element, 20, 0)
        await release(element, 20, 0)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onMove).toHaveBeenCalled()
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].offset).toEqual({ x: 20, y: 0 })
    })

    test("stops responding to pointers once removed", async () => {
        const onStart = jest.fn()
        const stop = drag(element, { onStart })
        stop()

        await dragTo(element, 100, 50)
        await release(element)

        expect(onStart).not.toHaveBeenCalled()
        expect(element.style.transform).toBe("")
    })

    test("onStart fires", async () => {
        const onStart = jest.fn()
        makeDraggable(element, { onStart })

        const pointer = await gesture(element).to(100, 100)
        pointer.end()
        await nextFrame()

        expect(onStart).toBeCalledTimes(1)
    })
})

/**
 * A copy of framer-motion's WillChangeMotionValue, which motion-dom can't
 * import. Vanilla drag() has no will-change option: it only adds to a
 * will-change value when one is configured globally.
 */
class TestWillChange extends MotionValue<string> {
    add(name: string) {
        if (transformProps.has(name) || acceleratedValues.has(name)) {
            this.set("transform")
        }
    }
}

describe("dragging", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    describe("willChange", () => {
        beforeEach(() => {
            MotionGlobalConfig.WillChange = TestWillChange as any
        })

        afterEach(() => {
            MotionGlobalConfig.WillChange = undefined
        })

        test("willChange is applied correctly", async () => {
            makeDraggable(element, {
                transition: { bounceStiffness: 100000, bounceDamping: 100000 },
            })

            const pointer = await gesture(element).to(100, 100)
            await nextFrame()

            expect(getValue(element, "willChange")?.get()).toBe("transform")
            expect(element.style.willChange).toBe("transform")

            pointer.end()
        })

        test("willChange is applied correctly when other values are animating", async () => {
            makeDraggable(element, {
                axis: "y",
                transition: { bounceStiffness: 100000, bounceDamping: 100000 },
            })

            const [animation] = animateElement(
                element,
                { x: [0, 100] },
                { duration: 5 },
                visualElementStore.get(element)
            )

            await nextFrame()
            expect(getValue(element, "x")!.isAnimating()).toBe(true)

            const pointer = await gesture(element).to(100, 100)
            await nextFrame()

            expect(element.style.willChange).toBe("transform")

            pointer.end()
            await nextFrame()

            expect(element.style.willChange).toBe("transform")

            animation.stop()
        })
    })

    test("willChange isn't set when no will-change value is configured", async () => {
        makeDraggable(element)

        const pointer = await gesture(element).to(100, 100)
        await nextFrame()

        expect(element.style.willChange).toBe("")

        pointer.end()
    })

    test("onEnd fires", async () => {
        const onEnd = jest.fn()
        makeDraggable(element, { onEnd })

        const pointer = await gesture(element).to(100, 100)
        pointer.end()
        await nextFrame()

        expect(onEnd).toBeCalledTimes(1)
    })

    test("onEnd fires when a child stops pointerup propagation (#2794)", async () => {
        const onEnd = jest.fn()
        const child = createElement("div", element)
        child.addEventListener("pointerup", (event) => event.stopPropagation())

        makeDraggable(element, { axis: "y", onEnd })

        const pointer = await gesture(element).to(0, 100)
        pointer.end(child)
        await nextFrame()

        expect(onEnd).toBeCalledTimes(1)
    })

    test("applies a pointermove that arrives in the same frame as pointerup", async () => {
        const onEnd = jest.fn()
        makeDraggable(element, { axis: "x", momentum: false, onEnd })

        pointer(element, "pointerdown", 0, 0)
        pointer(document.body, "pointermove", 10, 0)
        await nextFrame()
        expect(values(element).x).toBe(10)

        pointer(document.body, "pointermove", 100, 0)
        pointer(element, "pointerup", 100, 0)
        await nextFrame()

        expect(values(element).x).toBe(100)
        expect(onEnd).toBeCalledTimes(1)
        expect(onEnd.mock.calls[0][1].offset.x).toBe(100)
    })

    test("onEnd doesn't fire if dragging never initiated", async () => {
        const onEnd = jest.fn()
        makeDraggable(element, { axis: "x", directionLock: true, onEnd })

        const pointer = await gesture(element).to(0, 0)
        pointer.end()
        await nextFrame()

        expect(onEnd).not.toBeCalled()
    })

    test("onEnd does fire even if the motion values were physically reset", async () => {
        const onStart = jest.fn()
        const onEnd = jest.fn()
        makeDraggable(element, {
            axis: "x",
            directionLock: true,
            onMove: () => getValue(element, "x")!.set(0),
            onStart,
            onEnd,
        })

        const pointer = await gesture(element).to(10, 0)
        pointer.end()
        await nextFrame()

        expect(onStart).toBeCalledTimes(1)
        expect(onEnd).toBeCalledTimes(1)
    })

    test("onEnd receives the same point as the latest onMove", async () => {
        const onEnd = deferred<Point>()
        const p: Point = { x: 0, y: 0 }

        makeDraggable(element, {
            onMove: (_e, { point }) => {
                p.x = point.x
                p.y = point.y
            },
            onEnd: (_e, { point }) => onEnd.resolve(point),
        })

        const pointer = await gesture(element).to(50, 50)
        pointer.end()

        await expect(onEnd.promise).resolves.toEqual(p)
        expect(p).toEqual({ x: 50, y: 50 })
    })

    test("onTransitionEnd fires", async () => {
        const onTransitionEnd = deferred<boolean>()
        makeDraggable(element, {
            onTransitionEnd: () => onTransitionEnd.resolve(true),
            constraints: { top: 0, left: 0, right: 0, bottom: 0 },
            transition: { bounceStiffness: 100000, bounceDamping: 100000 },
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        await expect(onTransitionEnd.promise).resolves.toBe(true)
    })

    test("momentum is applied", async () => {
        makeDraggable(element, { axis: "x" })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        /**
         * Wait on frames, not wall-clock time: on a loaded machine 40ms can
         * pass with only the animation's first frame (where it's still at
         * the release point) having run.
         */
        await nextFrame()
        await nextFrame()

        expect(values(element).x).toBeGreaterThan(50)
    })

    test("momentum: false stops at the release point", async () => {
        makeDraggable(element, { axis: "x", momentum: false })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        await nextFrame()
        await nextFrame()

        expect(values(element).x).toBe(50)
    })

    test("limit to initial direction: x", async () => {
        const onDirectionLock = jest.fn()
        makeDraggable(element, { directionLock: true, onDirectionLock })

        const pointer = await gesture(element).to(100, 0)
        await pointer.to(50, 4)
        await pointer.to(200, 10)
        pointer.end()

        expect(values(element)).toEqual({ x: 200, y: 0 })
        expect(onDirectionLock).toBeCalledTimes(1)
        expect(onDirectionLock).toBeCalledWith("x")
    })

    test("limit to initial direction: y", async () => {
        const onDirectionLock = jest.fn()
        makeDraggable(element, {
            axis: "y",
            directionLock: true,
            onDirectionLock,
        })

        const pointer = await gesture(element).to(0, 100)
        await pointer.to(4, 50)
        await pointer.to(10, 200)
        pointer.end()

        expect(values(element)).toEqual({ x: 0, y: 200 })
        expect(onDirectionLock).toBeCalledWith("y")
    })

    describe("nested draggable elements", () => {
        let parent: HTMLElement
        let child: HTMLElement

        beforeEach(() => {
            parent = element
            child = createElement("div", parent)
        })

        test("block drag propagation", async () => {
            makeDraggable(parent, { axis: "x" })
            makeDraggable(child)

            const pointer = await gesture(child).to(10, 0)
            await pointer.to(20, 0)
            pointer.end()

            expect({
                parentX: values(parent).x,
                childX: values(child).x,
            }).toEqual({ parentX: 0, childX: 20 })
        })

        test("block drag propagation release velocity", async () => {
            makeDraggable(parent, { axis: "x" })
            makeDraggable(child)

            const pointer = await gesture(child).to(10, 0)
            await pointer.to(20, 0)
            pointer.end()

            await sleep(40)

            expect(values(parent).x).toEqual(0)
        })

        test("block drag propagation even after parent has been dragged", async () => {
            makeDraggable(parent, { axis: "x" })
            makeDraggable(child)

            let pointer = await gesture(parent).to(10, 0)
            await pointer.to(20, 0)
            pointer.end()

            pointer = await gesture(child).to(10, 0)
            await pointer.to(20, 0)
            pointer.end()

            expect(values(parent).x).toBeCloseTo(20)
            expect(values(child).x).toBeCloseTo(20)
        })

        test("enable drag propagation", async () => {
            makeDraggable(parent, { axis: "x" })
            makeDraggable(child, { axis: "x", propagation: true })

            const pointer = await gesture(child).to(10, 0)
            await pointer.to(20, 0)
            pointer.end()

            expect({
                parentX: values(parent).x,
                childX: values(child).x,
            }).toEqual({ parentX: 20, childX: 20 })
        })

        test("allow drag propagation on opposing axis", async () => {
            makeDraggable(parent, { axis: "x" })
            makeDraggable(child, { axis: "y" })

            const pointer = await gesture(child).to(10, 10)
            await pointer.to(20, 20)
            pointer.end()

            expect({
                parentX: values(parent).x,
                parentY: values(parent).y,
                childX: values(child).x,
                childY: values(child).y,
            }).toEqual({ parentX: 20, parentY: 0, childX: 0, childY: 20 })
        })
    })

    test("impose left drag constraint", async () => {
        makeDraggable(element, { constraints: { left: -100 }, elastic: false })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(-200, 50)
        pointer.end()

        expect(values(element)).toEqual({ x: -100, y: 50 })
    })

    test("impose right drag constraint", async () => {
        makeDraggable(element, { constraints: { right: 300 }, elastic: false })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, 50)
        pointer.end()

        expect(values(element)).toEqual({ x: 300, y: 50 })
    })

    test("impose top drag constraint", async () => {
        makeDraggable(element, { constraints: { top: -100 }, elastic: false })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, -500)
        pointer.end()

        expect(values(element)).toEqual({ x: 500, y: -100 })
    })

    test("impose bottom drag constraint", async () => {
        makeDraggable(element, {
            constraints: { bottom: 100 },
            elastic: false,
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, 500)
        pointer.end()

        expect(values(element)).toEqual({ x: 500, y: 100 })
    })

    test("drag constraints can be replaced by calling drag() again", async () => {
        const stop = drag(element, {
            constraints: { top: -100, bottom: 0 },
            elastic: false,
        })
        stop()
        makeDraggable(element, {
            constraints: { top: -50, bottom: 0 },
            elastic: false,
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, -500)
        pointer.end()

        expect(values(element)).toEqual({ x: 500, y: -50 })
    })

    test("onMeasureConstraints can override element constraints", async () => {
        const container = createElement()
        const onMeasureConstraints = jest.fn(() => ({
            top: 0,
            left: -10,
            right: 10,
            bottom: 0,
        }))
        makeDraggable(element, {
            constraints: container,
            elastic: false,
            momentum: false,
            onMeasureConstraints,
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(500, 500)
        pointer.end()

        expect(onMeasureConstraints).toHaveBeenCalled()
        expect(values(element)).toEqual({ x: 10, y: 0 })
    })

    test("applies drag transition", async () => {
        makeDraggable(element, {
            axis: "x",
            constraints: { left: -500, right: 500 },
            elastic: true,
            momentum: false,
            transition: { bounceStiffness: 300000, bounceDamping: 1000000 },
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(-500, 0)
        pointer.end()
        await sleep(50)

        expect(values(element).x).toBeCloseTo(-500)
    })

    test("snapToOrigin animates back to the origin on release", async () => {
        const onTransitionEnd = deferred()
        makeDraggable(element, {
            snapToOrigin: true,
            transition: { bounceStiffness: 100000, bounceDamping: 100000 },
            onTransitionEnd: () => onTransitionEnd.resolve(),
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(100, 100)
        pointer.end()

        await onTransitionEnd.promise

        expect(values(element).x).toBeCloseTo(0, 0)
        expect(values(element).y).toBeCloseTo(0, 0)
    })

    test("pointer down kills momentum", async () => {
        makeDraggable(element)

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(100, 100)
        pointer.end()

        const x = getValue(element, "x")!
        expect(x.isAnimating()).toBe(true)

        const lastX = x.get()
        gesture(element)
        await sleep(20)

        expect(x.isAnimating()).toBe(false)
        expect(x.get()).toBe(lastX)
    })

    test("cleans up pan session event listeners when stopped during an active gesture", async () => {
        const addListener = jest.spyOn(window, "addEventListener")
        const removeListener = jest.spyOn(window, "removeEventListener")

        const onMove = jest.fn()
        const onEnd = jest.fn()
        const stop = drag(element, { onMove, onEnd })

        pointer(element, "pointerdown")
        await nextFrame()

        const added = addListener.mock.calls
            .filter(([type]) => type === "pointermove")
            .map(([, listener]) => listener)
        expect(added.length).toBeGreaterThan(0)

        const xBefore = values(element).x

        stop()
        await nextFrame()

        const removed = removeListener.mock.calls
            .filter(([type]) => type === "pointermove")
            .map(([, listener]) => listener)
        added.forEach((listener) => expect(removed).toContain(listener))

        pointer(document.body, "pointermove", 100, 100)
        await nextFrame()
        pointer(element, "pointerup", 100, 100)
        await nextFrame()

        expect(values(element).x).toBe(xBefore)
        expect(onMove).not.toBeCalled()
        expect(onEnd).not.toBeCalled()

        addListener.mockRestore()
        removeListener.mockRestore()
    })

    test("stopping during an active gesture releases the drag lock", async () => {
        const other = createElement()
        const onStart = jest.fn()
        const stop = drag(element)
        makeDraggable(other, { momentum: false, onStart })

        const first = await gesture(element).to(50, 50)
        stop()
        first.end()

        const pointer = await gesture(other).to(50, 50)
        pointer.end()
        await nextFrame()

        expect(onStart).toBeCalledTimes(1)
        expect(values(other)).toEqual({ x: 50, y: 50 })
    })

    test("handles several elements from a selector", async () => {
        const a = createElement()
        const b = createElement()
        a.className = b.className = "draggable"
        makeDraggable(".draggable", { momentum: false })

        let pointer = await gesture(a).to(10, 0)
        pointer.end()
        pointer = await gesture(b).to(0, 20)
        pointer.end()

        expect(values(a)).toEqual({ x: 10, y: 0 })
        expect(values(b)).toEqual({ x: 0, y: 20 })
    })
})

describe("drag in scopeMotion", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = createElement()
    })

    afterEach(() => {
        document.body.innerHTML = ""
    })

    test("stop() removes the gesture", async () => {
        const scope = scopeMotion(() => {
            drag(element, { momentum: false })
        })
        scope.stop()

        await dragTo(element, 100, 50)
        await release(element)

        expect(values(element)).toEqual({ x: 0, y: 0 })
        expect(element.style.getPropertyValue("touch-action")).toBe("")
    })

    test("stop() stops the momentum animation", async () => {
        const scope = scopeMotion(() => {
            drag(element, { axis: "x" })
        })

        const pointer = await gesture(element).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()
        await nextFrame()
        await nextFrame()

        scope.stop()
        const x = values(element).x
        await nextFrame()
        await nextFrame()

        expect(values(element).x).toBe(x)
    })

    test("collects work started in drag callbacks", async () => {
        const delayed = jest.fn()
        const scope = scopeMotion(() => {
            drag(element, {
                momentum: false,
                onStart: () => delay(delayed, 1000),
            })
        })

        await dragTo(element, 100, 50)
        await release(element)
        expect(delayed).not.toHaveBeenCalled()
        scope.stop()

        // Jump the clock past the delay rather than waiting on wall time
        const now = performance.now() + 2000
        const spy = jest.spyOn(performance, "now").mockReturnValue(now)
        await nextFrame()
        await nextFrame()
        spy.mockRestore()

        expect(delayed).not.toHaveBeenCalled()
    })

    test("cancel() restores the element's style attribute", async () => {
        element.setAttribute("style", "color: red")
        const scope = scopeMotion(() => {
            drag(element, { momentum: false })
        })

        await dragTo(element, 100, 50)
        await release(element)
        expect(element.style.transform).not.toBe("")

        scope.cancel()

        expect(element.getAttribute("style")).toBe("color: red")
    })

    test("resolves selectors inside the root", async () => {
        element.className = "box"
        const outside = createElement()
        outside.className = "box"
        const root = document.createElement("div")
        document.body.appendChild(root)
        root.appendChild(element)

        const scope = scopeMotion(root, () => {
            drag(".box", { momentum: false })
        })

        await dragTo(outside, 100, 50)
        await release(outside)
        expect(values(outside)).toEqual({ x: 0, y: 0 })

        scope.stop()
    })
})
