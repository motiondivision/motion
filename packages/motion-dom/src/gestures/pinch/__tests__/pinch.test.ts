import { animateElement } from "../../../animation/animate/element"
import { styleSubjectEffect } from "../../../effects/style"
import { frame } from "../../../frameloop"
import { scopeMotion } from "../../../scope"
import { drag } from "../../drag"
import { pinch, PinchInfo, PinchOptions } from ".."

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * JSDOM has no PointerEvent, so fake one with an id and client point.
 */
function pointer(
    target: EventTarget,
    type: string,
    pointerId: number,
    clientX: number,
    clientY: number
) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, {
        pointerId,
        isPrimary: pointerId === 1,
        button: 0,
        pointerType: "touch",
        clientX,
        clientY,
        pageX: clientX,
        pageY: clientY,
    })
    target.dispatchEvent(event)
    return event
}

function wheel(
    target: EventTarget,
    deltaY: number,
    x = 0,
    y = 0,
    ctrlKey = true
) {
    const event = new Event("wheel", { bubbles: true, cancelable: true })
    Object.assign(event, { deltaY, clientX: x, clientY: y, ctrlKey })
    target.dispatchEvent(event)
    return event
}

function gestureEvent(
    target: EventTarget,
    type: string,
    scale: number,
    rotation = 0,
    x = 0,
    y = 0
) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { scale, rotation, clientX: x, clientY: y })
    target.dispatchEvent(event)
    return event
}

type Pair = [number, number, number, number]

/**
 * Put two touches down at a/b, wait for the gesture to measure, then
 * move them to the given positions one frame at a time.
 */
async function twoFinger(target: Element, [ax, ay, bx, by]: Pair) {
    pointer(target, "pointerdown", 1, ax, ay)
    pointer(target, "pointerdown", 2, bx, by)
    await nextFrame()

    const controls = {
        to: async ([ax, ay, bx, by]: Pair) => {
            pointer(window, "pointermove", 1, ax, ay)
            pointer(window, "pointermove", 2, bx, by)
            await nextFrame()
            return controls
        },
        end: async () => {
            pointer(window, "pointerup", 1, 0, 0)
            pointer(window, "pointerup", 2, 0, 0)
            await nextFrame()
        },
    }
    return controls
}

/**
 * JSDOM has no layout. Give the element a box centred on (cx, cy) that
 * follows its x/y motion values, as a browser's would.
 */
function layout(element: HTMLElement, cx: number, cy: number, size = 100) {
    element.getBoundingClientRect = () => {
        const x = (styleSubjectEffect.get(element, "x")?.get() as number) ?? 0
        const y = (styleSubjectEffect.get(element, "y")?.get() as number) ?? 0
        const left = cx + x - size / 2
        const top = cy + y - size / 2
        return {
            left,
            top,
            width: size,
            height: size,
            right: left + size,
            bottom: top + size,
            x: left,
            y: top,
            toJSON() {},
        } as DOMRect
    }
}

const value = (element: Element, key: string) =>
    styleSubjectEffect.get(element as HTMLElement, key)?.get() as number

let stops: VoidFunction[] = []

function makePinchable(element: Element | string, options?: PinchOptions) {
    const stop = pinch(element, options)
    stops.push(stop)
    return stop
}

let element: HTMLElement

beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
    layout(element, 50, 0)
})

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

describe("pinch", () => {
    test("scales the element by the change in distance between two touches", async () => {
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "x")).toBeCloseTo(0)
        expect(value(element, "y")).toBeCloseTo(0)

        await nextFrame()
        expect(element.style.transform).toBe("scale(2)")

        await gesture.end()
    })

    test("zooms around the point between the touches", async () => {
        layout(element, 0, 0)
        makePinchable(element)

        const gesture = await twoFinger(element, [50, 0, 150, 0])
        await gesture.to([0, 0, 200, 0])

        // The point under the fingers (100, 0) stays under them.
        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "x")).toBeCloseTo(-100)
        expect(value(element, "y")).toBeCloseTo(0)

        await gesture.end()
    })

    test("moves the element with the touches", async () => {
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, 20, 150, 20])

        expect(value(element, "scale")).toBeCloseTo(1)
        expect(value(element, "x")).toBeCloseTo(50)
        expect(value(element, "y")).toBeCloseTo(20)

        await gesture.end()
    })

    test("pan: false keeps the element in place", async () => {
        layout(element, 0, 0)
        makePinchable(element, { pan: false })

        const gesture = await twoFinger(element, [50, 0, 150, 0])
        await gesture.to([0, 30, 200, 30])

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "x") ?? 0).toBeCloseTo(0)
        expect(value(element, "y") ?? 0).toBeCloseTo(0)

        await gesture.end()
    })

    test("doesn't rotate by default", async () => {
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, -50, 50, 50])

        expect(value(element, "rotate") ?? 0).toBeCloseTo(0)

        await gesture.end()
    })

    test("rotates with the touches when rotate is set", async () => {
        makePinchable(element, { rotate: true })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, -50, 50, 50])

        expect(value(element, "rotate")).toBeCloseTo(90)
        expect(value(element, "scale")).toBeCloseTo(1)
        expect(value(element, "x")).toBeCloseTo(0)
        expect(value(element, "y")).toBeCloseTo(0)

        await gesture.end()
    })

    test("rotation keeps counting past 180deg", async () => {
        makePinchable(element, { rotate: true })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, -50, 50, 50]) // 90
        await gesture.to([100, 0, 0, 0]) // 180
        await gesture.to([50, 50, 50, -50]) // 270

        expect(value(element, "rotate")).toBeCloseTo(270)

        await gesture.end()
    })

    test("clamps scale to min and max", async () => {
        makePinchable(element, { min: 0.5, max: 1.5 })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(value(element, "scale")).toBeCloseTo(1.5)

        await gesture.to([40, 0, 60, 0])
        expect(value(element, "scale")).toBeCloseTo(0.5)

        await gesture.end()
    })

    test("continues from the current scale on the next pinch", async () => {
        makePinchable(element)

        let gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(value(element, "scale")).toBeCloseTo(4)
        await gesture.end()
    })

    test("a single touch doesn't pinch", async () => {
        const onStart = jest.fn()
        makePinchable(element, { onStart })

        pointer(element, "pointerdown", 1, 0, 0)
        pointer(window, "pointermove", 1, 100, 0)
        await nextFrame()
        pointer(window, "pointerup", 1, 100, 0)

        expect(onStart).not.toHaveBeenCalled()
        expect(value(element, "scale")).toBe(undefined)
    })

    test("ends when either touch lifts", async () => {
        const onEnd = jest.fn()
        makePinchable(element, { onEnd })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        pointer(window, "pointerup", 2, 150, 0)
        expect(onEnd).toHaveBeenCalledTimes(1)

        // The remaining touch no longer pinches.
        pointer(window, "pointermove", 1, -100, 0)
        await nextFrame()
        expect(value(element, "scale")).toBeCloseTo(2)

        await gesture.end()
        expect(onEnd).toHaveBeenCalledTimes(1)
    })

    test("calls onStart, onMove and onEnd with gesture info", async () => {
        const onStart = jest.fn()
        const onMove = jest.fn()
        const onEnd = jest.fn()
        makePinchable(element, { rotate: true, onStart, onMove, onEnd })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onStart.mock.calls[0][1]).toEqual({
            point: { x: 50, y: 0 },
            offset: { x: 0, y: 0 },
            scale: 1,
            rotate: 0,
        })

        await gesture.to([0, 20, 200, 20])
        expect(onMove).toHaveBeenCalledTimes(1)
        const info: PinchInfo = onMove.mock.calls[0][1]
        expect(info.point).toEqual({ x: 100, y: 20 })
        expect(info.offset).toEqual({ x: 50, y: 20 })
        expect(info.scale).toBeCloseTo(2)
        expect(info.rotate).toBeCloseTo(0)

        // No movement, no onMove.
        await nextFrame()
        expect(onMove).toHaveBeenCalledTimes(1)

        await gesture.end()
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].scale).toBeCloseTo(2)
    })

    test("onEnd can animate the values", async () => {
        makePinchable(element, {
            onEnd: () => {
                animateElement(element, { scale: 1 }, { duration: 0.05 })
            },
        })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()
        await sleep(150)

        expect(value(element, "scale")).toBe(1)
    })

    test("a new pinch stops an animation on its values", async () => {
        makePinchable(element)
        animateElement(element, { scale: 3 }, { duration: 10 })
        await nextFrame()

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        const start = value(element, "scale")
        await nextFrame()
        await nextFrame()
        expect(value(element, "scale")).toBe(start)

        await gesture.end()
    })

    test("picks up a transform already on the element", async () => {
        // Browsers report the computed transform as a matrix.
        element.style.transform = "matrix(2, 0, 0, 2, 0, 0)"
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(value(element, "scale")).toBeCloseTo(4)

        await gesture.end()
    })

    test("disables browser touch gestures, restored on stop", () => {
        element.style.touchAction = "pan-y"
        const stop = makePinchable(element)
        expect(element.style.touchAction).toBe("none")
        stop()
        expect(element.style.touchAction).toBe("pan-y")
    })

    test("stop removes the gesture", async () => {
        const onStart = jest.fn()
        const stop = makePinchable(element, { onStart })
        stop()

        await twoFinger(element, [0, 0, 100, 0])
        expect(onStart).not.toHaveBeenCalled()
        wheel(element, -10)
        expect(onStart).not.toHaveBeenCalled()
    })

    test("accepts a selector", async () => {
        element.id = "box"
        makePinchable("#box")

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(value(element, "scale")).toBeCloseTo(2)
        await gesture.end()
    })

    test("is collected by scopeMotion", async () => {
        const onStart = jest.fn()
        const scope = scopeMotion(() => {
            pinch(element, { onStart })
        })
        scope.stop()

        await twoFinger(element, [0, 0, 100, 0])
        expect(onStart).not.toHaveBeenCalled()
    })
})

describe("pinch with a trackpad", () => {
    test("ctrl + wheel zooms around the cursor", async () => {
        layout(element, 0, 0)
        makePinchable(element)

        const event = wheel(element, -100 * Math.log(2), 100, 0)
        expect(event.defaultPrevented).toBe(true)
        await nextFrame()
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "x")).toBeCloseTo(-100)
    })

    test("accumulates wheel events into one gesture that ends when they stop", async () => {
        const onStart = jest.fn()
        const onEnd = jest.fn()
        makePinchable(element, { onStart, onEnd })

        wheel(element, -50 * Math.log(2), 50, 0)
        await nextFrame()
        wheel(element, -50 * Math.log(2), 50, 0)
        await nextFrame()
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onEnd).not.toHaveBeenCalled()

        await sleep(250)
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].scale).toBeCloseTo(2)
    })

    test("ignores wheel without ctrl so the page still scrolls", async () => {
        const onStart = jest.fn()
        makePinchable(element, { onStart })

        const event = wheel(element, -100, 0, 0, false)
        expect(event.defaultPrevented).toBe(false)
        await nextFrame()
        expect(onStart).not.toHaveBeenCalled()
    })

    test("Safari gesture events scale and rotate", async () => {
        const onEnd = jest.fn()
        makePinchable(element, { rotate: true, onEnd })

        const start = gestureEvent(element, "gesturestart", 1, 0, 50, 0)
        expect(start.defaultPrevented).toBe(true)
        await nextFrame()
        gestureEvent(element, "gesturechange", 2, 45, 50, 0)
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "rotate")).toBeCloseTo(45)

        gestureEvent(element, "gestureend", 2, 45, 50, 0)
        expect(onEnd).toHaveBeenCalledTimes(1)
    })

    test("Safari gesture events are ignored while touches pinch", async () => {
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        gestureEvent(element, "gesturestart", 1)
        await gesture.to([-50, 0, 150, 0])
        gestureEvent(element, "gesturechange", 2)
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)
        await gesture.end()
    })
})

describe("pinch with drag", () => {
    test("drag keeps the position while pinch scales", async () => {
        const removeDrag = drag(element, { momentum: false })
        stops.push(removeDrag)
        makePinchable(element)

        // First touch drags...
        pointer(element, "pointerdown", 1, 0, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 20, 0)
        await nextFrame()

        // ...the second pinches.
        pointer(element, "pointerdown", 2, 120, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 30, 0)
        pointer(window, "pointermove", 2, 230, 0)
        await nextFrame()

        const ve = require("../../../render/store").visualElementStore.get(
            element
        )
        expect(ve.getValue("scale").get()).toBeCloseTo(2)
        // Drag owns x, so it follows the dragging touch only.
        expect(ve.getValue("x").get()).toBeCloseTo(30)

        pointer(window, "pointerup", 1, 30, 0)
        pointer(window, "pointerup", 2, 230, 0)
        await nextFrame()
    })
})
