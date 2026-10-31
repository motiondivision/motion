import { drag } from "../../drag"
import {
    createElement,
    gesture,
    nextFrame,
    pointer,
    values,
} from "../../drag/__tests__/utils"
import { hover } from "../../hover"
import { press } from "../../press"
import {
    claimGesture,
    Gesture,
    getGestures,
    isGestureActive,
    joinGesture,
    leaveGesture,
    onGestureChange,
} from ".."

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    getGestures().forEach(leaveGesture)
    document.body.innerHTML = ""
})

function track(element: Element) {
    const log: string[] = []
    stops.push(
        press(element, () => {
            log.push("start")
            return (_event, { success }) => log.push(success ? "tap" : "cancel")
        })
    )
    return log
}

describe("arena", () => {
    test("the first gesture to claim a pointer wins", () => {
        const element = createElement()
        const cancelled: string[] = []
        const a = joinGesture({
            kind: "a",
            element,
            pointerId: 1,
            cancel: () => cancelled.push("a"),
        })
        const b = joinGesture({
            kind: "b",
            element,
            pointerId: 1,
            cancel: () => cancelled.push("b"),
        })

        expect(claimGesture(a)).toBe(true)
        expect(cancelled).toEqual(["b"])
        expect(b.phase).toBe("ended")
        expect(b.claimedBy).toBe(a)
        expect(getGestures()).toEqual([a])
    })

    test("a claim fails while an active gesture can't run alongside it", () => {
        const element = createElement()
        const a = joinGesture({ kind: "a", element, pointerId: 1 })
        claimGesture(a)
        const b = joinGesture({ kind: "b", element, pointerId: 1 })

        expect(claimGesture(b)).toBe(false)
        expect(a.phase).toBe("active")
    })

    test("gestures that run together both stay", () => {
        const element = createElement()
        const a = joinGesture({
            kind: "a",
            element,
            pointerId: 1,
            with: (other) => other.kind === "b",
        })
        const b = joinGesture({ kind: "b", element, pointerId: 1 })

        expect(claimGesture(a)).toBe(true)
        expect(claimGesture(b)).toBe(true)
        expect(isGestureActive("a")).toBe(true)
        expect(isGestureActive("b")).toBe(true)
    })

    test("pointers have separate arenas", () => {
        const element = createElement()
        const a = joinGesture({ kind: "a", element, pointerId: 1 })
        const b = joinGesture({ kind: "b", element, pointerId: 2 })

        expect(claimGesture(a)).toBe(true)
        expect(claimGesture(b)).toBe(true)
    })

    test("gestures that don't compete never block a claim", () => {
        const element = createElement()
        joinGesture({
            kind: "hover",
            element,
            pointerId: 1,
            phase: "active",
            passive: true,
        })
        const a = joinGesture({ kind: "a", element, pointerId: 1 })

        expect(claimGesture(a)).toBe(true)
        expect(isGestureActive("hover", element)).toBe(true)
    })

    test("onGestureChange reports each phase", () => {
        const element = createElement()
        const phases: string[] = []
        const unsubscribe = onGestureChange((g: Gesture) =>
            phases.push(g.kind + ":" + g.phase)
        )

        const a = joinGesture({ kind: "a", element, pointerId: 1 })
        claimGesture(a)
        leaveGesture(a)
        unsubscribe()
        joinGesture({ kind: "b", element, pointerId: 1 })

        expect(phases).toEqual(["a:possible", "a:active", "a:ended"])
    })
})

describe("press and drag", () => {
    test("a press without movement still taps a draggable element", async () => {
        const element = createElement()
        stops.push(drag(element, { momentum: false }))
        const log = track(element)

        pointer(element, "pointerdown")
        await nextFrame()
        pointer(element, "pointerup")
        await nextFrame()

        expect(log).toEqual(["start", "tap"])
        expect(getGestures()).toEqual([])
    })

    test("dragging an element keeps its press until release, then cancels it", async () => {
        const element = createElement()
        stops.push(drag(element, { momentum: false }))
        const log = track(element)

        const pointerGesture = await gesture(element).to(50, 0)

        expect(log).toEqual(["start"])
        expect(isGestureActive("drag", element)).toBe(true)
        expect(getGestures("press", element)).toHaveLength(1)

        pointerGesture.end()
        await nextFrame()

        expect(log).toEqual(["start", "cancel"])
        expect(getGestures()).toEqual([])
    })

    test("dragging a parent cancels a child's press straight away", async () => {
        const parent = createElement()
        const child = createElement("button", parent)
        stops.push(drag(parent, { momentum: false }))
        const log = track(child)

        const pointerGesture = await gesture(parent, child).to(50, 0)

        expect(log).toEqual(["start", "cancel"])
        expect(values(parent)).toEqual({ x: 50, y: 0 })

        pointerGesture.end(child)
        await nextFrame()

        expect(log).toEqual(["start", "cancel"])
        expect(getGestures()).toEqual([])
    })

    test("dragging a child cancels a parent's press", async () => {
        const parent = createElement()
        const child = createElement("div", parent)
        stops.push(drag(child, { momentum: false }))
        const log = track(parent)

        const pointerGesture = await gesture(child).to(50, 0)
        pointerGesture.end()
        await nextFrame()

        expect(log).toEqual(["start", "cancel"])
    })

    test("nested presses both tap", async () => {
        const parent = createElement()
        const child = createElement("button", parent)
        const parentLog = track(parent)
        const childLog = track(child)

        pointer(child, "pointerdown")
        pointer(child, "pointerup")

        expect(childLog).toEqual(["start", "tap"])
        expect(parentLog).toEqual(["start", "tap"])
    })

    test("stopping a press mid-gesture removes it from the registry", () => {
        const element = createElement()
        const stop = press(element, () => {})

        pointer(element, "pointerdown")
        expect(getGestures("press")).toHaveLength(1)

        stop()
        expect(getGestures("press")).toEqual([])
    })
})

describe("drag and drag", () => {
    test("of nested drags on the same axis, only one drags", async () => {
        const parent = createElement()
        const child = createElement("div", parent)
        stops.push(drag(parent, { momentum: false }))
        stops.push(drag(child, { momentum: false }))

        const pointerGesture = await gesture(child).to(50, 0)

        expect(getGestures("drag")).toHaveLength(1)
        const moved = [values(parent).x, values(child).x].filter(Boolean)
        expect(moved).toEqual([50])

        pointerGesture.end()
        await nextFrame()
        expect(getGestures()).toEqual([])
    })

    test("nested drags on different axes both drag", async () => {
        const parent = createElement()
        const child = createElement("div", parent)
        stops.push(drag(parent, { axis: "y", momentum: false }))
        stops.push(drag(child, { axis: "x", momentum: false }))

        const pointerGesture = await gesture(child).to(40, 30)

        expect(getGestures("drag").map((g) => g.phase)).toEqual([
            "active",
            "active",
        ])
        expect(values(child).x).toBe(40)
        expect(values(parent).y).toBe(30)

        pointerGesture.end()
    })
})

describe("hover", () => {
    test("an active hover is in the registry until it ends", () => {
        const element = createElement()
        stops.push(hover(element, () => {}))

        const enter = new Event("pointerenter")
        Object.assign(enter, { pointerType: "mouse" })
        element.dispatchEvent(enter)
        expect(isGestureActive("hover", element)).toBe(true)

        const leave = new Event("pointerleave")
        Object.assign(leave, { pointerType: "mouse" })
        element.dispatchEvent(leave)
        expect(getGestures("hover")).toEqual([])
    })

    test("nested elements are hovered at the same time", () => {
        const parent = createElement()
        const child = createElement("div", parent)
        stops.push(hover(parent, () => {}))
        stops.push(hover(child, () => {}))

        for (const element of [parent, child]) {
            const enter = new Event("pointerenter")
            Object.assign(enter, { pointerType: "mouse" })
            element.dispatchEvent(enter)
        }

        expect(getGestures("hover")).toHaveLength(2)
    })
})
