import { animateElement } from "../../../animation/animate/element"
import { styleSubjectEffect } from "../../../effects/style"
import { frame } from "../../../frameloop"
import { visualElementStore } from "../../../render/store"
import { scopeMotion } from "../../../scope"
import { activeScope } from "../../../scope/active"
import { motionValue } from "../../../value"
import { drag } from "../../drag"
import { OnPinchStartEvent, pinch, PinchInfo, PinchOptions } from ".."

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
async function twoFinger(
    target: Element,
    [ax, ay, bx, by]: Pair,
    [a, b] = [1, 2]
) {
    pointer(target, "pointerdown", a, ax, ay)
    pointer(target, "pointerdown", b, bx, by)
    await nextFrame()

    const controls = {
        to: async ([ax, ay, bx, by]: Pair) => {
            pointer(window, "pointermove", a, ax, ay)
            pointer(window, "pointermove", b, bx, by)
            await nextFrame()
            return controls
        },
        end: async () => {
            pointer(window, "pointerup", a, 0, 0)
            pointer(window, "pointerup", b, 0, 0)
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
    const px = (key: string) => {
        const latest =
            (visualElementStore.get(element)?.getValue(key)?.get() as
                | number
                | string) ??
            styleSubjectEffect.get(element, key)?.get() ??
            0
        return typeof latest === "string" && latest.endsWith("%")
            ? (parseFloat(latest) * size) / 100
            : parseFloat(latest as string)
    }
    Object.defineProperty(element, "offsetWidth", { value: size })
    Object.defineProperty(element, "offsetHeight", { value: size })
    element.getBoundingClientRect = () => {
        const x = px("x")
        const y = px("y")
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

const noop = () => {}

function makePinchable(
    element: Element | string,
    onPinchStart: OnPinchStartEvent = noop,
    options?: PinchOptions
) {
    const stop = pinch(element, onPinchStart, options)
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
        expect(element.style.transform).toMatch(/^scale\((2|1\.9999\d*)\)$/)

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
        makePinchable(element, noop, { pan: false })

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
        makePinchable(element, noop, { rotate: true })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, -50, 50, 50])

        expect(value(element, "rotate")).toBeCloseTo(90)
        expect(value(element, "scale")).toBeCloseTo(1)
        expect(value(element, "x")).toBeCloseTo(0)
        expect(value(element, "y")).toBeCloseTo(0)

        await gesture.end()
    })

    test("rotation keeps counting past 180deg", async () => {
        makePinchable(element, noop, { rotate: true })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, -50, 50, 50]) // 90
        await gesture.to([100, 0, 0, 0]) // 180
        await gesture.to([50, 50, 50, -50]) // 270

        expect(value(element, "rotate")).toBeCloseTo(270)

        await gesture.end()
    })

    test("clamps scale to min and max", async () => {
        makePinchable(element, noop, { min: 0.5, max: 1.5 })

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
        makePinchable(element, onStart)

        pointer(element, "pointerdown", 1, 0, 0)
        pointer(window, "pointermove", 1, 100, 0)
        await nextFrame()
        pointer(window, "pointerup", 1, 100, 0)

        expect(onStart).not.toHaveBeenCalled()
        expect(value(element, "scale")).toBe(undefined)
    })

    test("ends when either touch lifts", async () => {
        const onEnd = jest.fn()
        makePinchable(element, () => onEnd)

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

    test("calls the start callback with the element and the starting event", async () => {
        const onStart = jest.fn()
        makePinchable(element, onStart)

        pointer(element, "pointerdown", 1, 0, 0)
        expect(onStart).not.toHaveBeenCalled()
        const second = pointer(element, "pointerdown", 2, 100, 0)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onStart.mock.calls[0][0]).toBe(element)
        expect(onStart.mock.calls[0][1]).toBe(second)

        pointer(window, "pointerup", 1, 0, 0)
        pointer(window, "pointerup", 2, 0, 0)
    })

    test("calls the returned onPinch and onComplete with gesture info", async () => {
        const onPinch = jest.fn()
        const onComplete = jest.fn()
        makePinchable(element, () => ({ onPinch, onComplete }), {
            rotate: true,
        })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        expect(onPinch).not.toHaveBeenCalled()

        await gesture.to([0, 20, 200, 20])
        expect(onPinch).toHaveBeenCalledTimes(1)
        const [event, info] = onPinch.mock.calls[0] as [Event, PinchInfo]
        expect(event.type).toBe("pointermove")
        expect(info.point).toEqual({ x: 100, y: 20 })
        expect(info.offset).toEqual({ x: 50, y: 20 })
        expect(info.scale).toBeCloseTo(2)
        expect(info.rotate).toBeCloseTo(0)

        // No movement, no onPinch.
        await nextFrame()
        expect(onPinch).toHaveBeenCalledTimes(1)
        expect(onComplete).not.toHaveBeenCalled()

        await gesture.end()
        expect(onPinch).toHaveBeenCalledTimes(1)
        expect(onComplete).toHaveBeenCalledTimes(1)
        const [endEvent, endInfo] = onComplete.mock.calls[0]
        expect(endEvent.type).toBe("pointerup")
        expect(endInfo.scale).toBeCloseTo(2)
        expect(endInfo.offset).toEqual({ x: 50, y: 20 })
    })

    test("a returned function is called once when the gesture ends", async () => {
        const onEnd = jest.fn()
        makePinchable(element, () => onEnd)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(onEnd).not.toHaveBeenCalled()

        await gesture.end()
        expect(onEnd).toHaveBeenCalledTimes(1)
        const [event, info] = onEnd.mock.calls[0] as [Event, PinchInfo]
        expect(event.type).toBe("pointerup")
        expect(info.scale).toBeCloseTo(2)
        expect(info.point).toEqual({ x: 50, y: 0 })
    })

    test("a returned object can have only onPinch", async () => {
        const onPinch = jest.fn()
        makePinchable(element, () => ({ onPinch }))

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        expect(onPinch).toHaveBeenCalledTimes(1)
        expect(value(element, "scale")).toBeCloseTo(2)
    })

    test("a returned object can have only onComplete", async () => {
        const onComplete = jest.fn()
        makePinchable(element, () => ({ onComplete }))

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete.mock.calls[0][1].scale).toBeCloseTo(2)
    })

    test("pinches when the start callback returns nothing", async () => {
        const onStart = jest.fn(() => undefined)
        makePinchable(element, onStart)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        expect(value(element, "scale")).toBeCloseTo(2)
        await gesture.end()

        expect(onStart).toHaveBeenCalledTimes(1)
    })

    test("calls the start callback once per gesture", async () => {
        const onComplete = jest.fn()
        const onStart = jest.fn(() => ({ onComplete }))
        makePinchable(element, onStart)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.to([-60, 0, 160, 0])

        // A third touch doesn't start another gesture.
        pointer(element, "pointerdown", 3, 50, 50)
        await nextFrame()
        pointer(window, "pointerup", 3, 50, 50)
        await gesture.end()

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("a new gesture calls the start callback again, with its own handlers", async () => {
        const ends: jest.Mock[] = []
        const onStart = jest.fn(() => {
            const onEnd = jest.fn()
            ends.push(onEnd)
            return onEnd
        })
        makePinchable(element, onStart)

        let gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        wheel(element, -10, 50, 0)
        await sleep(250)

        expect(onStart).toHaveBeenCalledTimes(3)
        expect(ends).toHaveLength(3)
        ends.forEach((onEnd) => expect(onEnd).toHaveBeenCalledTimes(1))
        expect(ends[0].mock.calls[0][1].scale).toBeCloseTo(2)
        expect(ends[1].mock.calls[0][1].scale).toBeCloseTo(2)
        expect(ends[2].mock.calls[0][0].type).toBe("wheel")
    })

    test("onComplete can animate the values", async () => {
        makePinchable(element, () => ({
            onComplete: () => {
                animateElement(element, { scale: 1 }, { duration: 0.05 })
            },
        }))

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
        const stop = makePinchable(element, onStart)
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
            pinch(element, onStart)
        })
        scope.stop()

        await twoFinger(element, [0, 0, 100, 0])
        expect(onStart).not.toHaveBeenCalled()
    })

    test("runs the start callback and its handlers in the active scope", async () => {
        const scopes: Record<string, unknown> = {}
        const record = (name: string) => () => {
            scopes[name] = activeScope.current
        }
        const other = document.createElement("div")
        document.body.appendChild(other)
        layout(other, 50, 0)

        const scope = scopeMotion(() => {
            pinch(element, () => {
                record("start")()
                return {
                    onPinch: record("onPinch"),
                    onComplete: record("onComplete"),
                }
            })
            pinch(other, () => {
                record("startFn")()
                return record("returnedFn")
            })
        })

        expect(activeScope.current).toBe(undefined)

        let gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()

        gesture = await twoFinger(other, [0, 0, 100, 0])
        await gesture.end()

        expect(Object.keys(scopes).sort()).toEqual([
            "onComplete",
            "onPinch",
            "returnedFn",
            "start",
            "startFn",
        ])
        for (const name in scopes) expect(scopes[name]).toBeDefined()

        scope.stop()
    })

    test("handlers left undefined are skipped in a scope", async () => {
        const scope = scopeMotion(() => {
            pinch(element, () => ({
                onPinch: undefined,
                onComplete: undefined,
            }))
        })

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 0, 150, 0])
        await gesture.end()
        expect(value(element, "scale")).toBeCloseTo(2)

        scope.stop()
    })
})

describe("pinch with a trackpad", () => {
    test("ctrl + wheel zooms around the cursor", async () => {
        layout(element, 0, 0)
        makePinchable(element)

        const event = wheel(element, -50 * Math.log(2), 100, 0)
        expect(event.defaultPrevented).toBe(true)
        wheel(element, -50 * Math.log(2), 100, 0)
        await nextFrame()
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)
        expect(value(element, "x")).toBeCloseTo(-100)
    })

    test("accumulates wheel events into one gesture that ends when they stop", async () => {
        const onEnd = jest.fn()
        const onStart = jest.fn(() => onEnd)
        makePinchable(element, onStart)

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
        makePinchable(element, onStart)

        const event = wheel(element, -100, 0, 0, false)
        expect(event.defaultPrevented).toBe(false)
        await nextFrame()
        expect(onStart).not.toHaveBeenCalled()
    })

    test("Safari gesture events scale and rotate", async () => {
        const onEnd = jest.fn()
        makePinchable(element, () => onEnd, { rotate: true })

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
    test("the element follows both touches while one of them drags", async () => {
        const removeDrag = drag(element, { momentum: false })
        stops.push(removeDrag)
        makePinchable(element)

        // First touch drags 20px...
        pointer(element, "pointerdown", 1, 0, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 20, 0)
        await nextFrame()

        // ...then a second pinches: 20 -> 30 and 120 -> 230 is 2x.
        pointer(element, "pointerdown", 2, 120, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 30, 0)
        pointer(window, "pointermove", 2, 230, 0)
        await nextFrame()
        await nextFrame()

        const ve = visualElementStore.get(element)!
        expect(ve.getValue("scale")!.get()).toBeCloseTo(2)

        /**
         * Points under the touches stay under them: the centre, at 70
         * after the drag, maps to 30 + 2 * (70 - 20) = 130, so x is 80.
         */
        expect(ve.getValue("x")!.get()).toBeCloseTo(80)

        // Drag carries on from there once the pinch ends.
        pointer(window, "pointerup", 2, 230, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 40, 0)
        await nextFrame()
        await nextFrame()
        expect(ve.getValue("x")!.get()).toBeCloseTo(90)

        pointer(window, "pointerup", 1, 40, 0)
        await nextFrame()
    })

    test("drag doesn't fling the element after a zoom", async () => {
        layout(element, 0, 0)
        stops.push(drag(element))
        makePinchable(element)

        // A zoom around a fixed point: the touches move fast, the focal
        // point doesn't.
        const gesture = await twoFinger(element, [40, 0, 60, 0])
        for (let i = 1; i <= 8; i++) {
            await gesture.to([40 - i * 20, 0, 60 + i * 20, 0])
        }
        const ve = visualElementStore.get(element)!
        const x = ve.getValue("x")!.get()
        await gesture.end()
        await sleep(300)

        expect(ve.getValue("x")!.get()).toBeCloseTo(x)
    })

    test("pinching one element while another drags still moves it", async () => {
        const other = document.createElement("div")
        document.body.appendChild(other)
        stops.push(drag(other, { momentum: false }))
        makePinchable(element)

        pointer(other, "pointerdown", 1, 500, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, 520, 0)
        await nextFrame()
        expect(visualElementStore.get(other)!.getValue("x")!.get()).toBe(20)

        const gesture = await twoFinger(element, [0, 0, 100, 0], [2, 3])
        await gesture.to([50, 20, 150, 20])
        expect(value(element, "x")).toBeCloseTo(50)
        expect(value(element, "y")).toBeCloseTo(20)
        await gesture.end()

        pointer(window, "pointerup", 1, 520, 0)
    })
})

describe("pinch edge cases", () => {
    test("x/y set during the gesture are kept", async () => {
        let nudged = false
        makePinchable(element, () => ({
            onPinch: () => {
                if (nudged) return
                nudged = true
                const x = styleSubjectEffect.get(element, "x")!
                x.set((x.get() as number) + 100)
            },
        }))

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, 0, 150, 0])
        expect(value(element, "x")).toBeCloseTo(150)
        await gesture.to([60, 0, 160, 0])
        expect(value(element, "x")).toBeCloseTo(160)

        await gesture.end()
    })

    test("an animation started mid-gesture doesn't take over afterwards", async () => {
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([10, 0, 110, 0])
        animateElement(element, { x: 300 }, { duration: 1 })
        await gesture.to([20, 0, 120, 0])
        await gesture.end()

        const x = value(element, "x")
        await sleep(100)
        expect(value(element, "x")).toBe(x)
    })

    test("zooms and rotates around an off-centre point", async () => {
        layout(element, 0, 0)
        makePinchable(element, noop, { rotate: true })

        const gesture = await twoFinger(element, [50, 0, 150, 0])
        await gesture.to([100, -50, 100, 50])

        // Rotating 90deg around (100, 0) moves the centre to (100, -100).
        expect(value(element, "rotate")).toBeCloseTo(90)
        expect(value(element, "scale")).toBeCloseTo(1)
        expect(value(element, "x")).toBeCloseTo(100)
        expect(value(element, "y")).toBeCloseTo(-100)

        await gesture.end()
    })

    test("works with px and % x/y", async () => {
        const x = motionValue<number | string>("-50%")
        const y = motionValue<number | string>("20px")
        styleSubjectEffect(element, { x, y } as any)
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([50, 20, 150, 20])

        expect(x.get()).toBeCloseTo(0)
        expect(y.get()).toBeCloseTo(40)

        await gesture.end()
    })

    test("doesn't produce NaN from a scale of 0", async () => {
        const scale = motionValue(0)
        styleSubjectEffect(element, { scale })
        makePinchable(element)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await gesture.to([-50, 10, 150, 10])

        expect(scale.get()).toBe(0)
        expect(value(element, "x")).toBeCloseTo(0)
        expect(value(element, "y")).toBeCloseTo(10)

        await gesture.end()
    })

    test("disabling mid-gesture ends it", async () => {
        const onEnd = jest.fn()
        let enabled = true
        const options = { max: 1.2 }
        const { addPinchListeners } = require("..")
        const remove = addPinchListeners(
            element,
            () =>
                ["scale", "rotate", "x", "y"].map((key) => {
                    let v = styleSubjectEffect.get(element, key)
                    if (!v) {
                        v = motionValue(key === "scale" ? 1 : 0)
                        styleSubjectEffect(element, { [key]: v })
                    }
                    return v
                }),
            () => enabled && options,
            () => onEnd
        )
        stops.push(remove)

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        enabled = false
        await gesture.to([-50, 0, 150, 0])

        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(value(element, "scale")).toBe(1)

        await gesture.end()
        expect(onEnd).toHaveBeenCalledTimes(1)
    })

    test("pinches when the second touch lands off the element", async () => {
        makePinchable(element)

        pointer(element, "pointerdown", 1, 0, 0)
        pointer(document.body, "pointerdown", 2, 100, 0)
        await nextFrame()
        pointer(window, "pointermove", 1, -50, 0)
        pointer(window, "pointermove", 2, 150, 0)
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(2)

        pointer(window, "pointerup", 1, 0, 0)
        pointer(window, "pointerup", 2, 0, 0)
    })

    test("ignores mouse pointers", async () => {
        const onStart = jest.fn()
        makePinchable(element, onStart)

        // A mouse press whose pointerup is swallowed (e.g. by a context menu)...
        const event = new Event("pointerdown", { bubbles: true })
        Object.assign(event, {
            pointerId: 9,
            pointerType: "mouse",
            clientX: 0,
            clientY: 0,
        })
        element.dispatchEvent(event)

        // ...doesn't turn the next single touch into a pinch.
        pointer(element, "pointerdown", 1, 50, 0)
        await nextFrame()
        expect(onStart).not.toHaveBeenCalled()
        pointer(window, "pointerup", 1, 50, 0)
    })

    test("doesn't stop animations on values it won't write", async () => {
        makePinchable(element)
        animateElement(element, { rotate: 90 }, { duration: 10 })
        await nextFrame()

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        const start = value(element, "rotate")
        await sleep(50)
        expect(value(element, "rotate")).not.toBe(start)

        await gesture.end()
    })

    test("stopping mid-gesture calls onEnd", async () => {
        const onEnd = jest.fn()
        const stop = makePinchable(element, () => onEnd)

        await twoFinger(element, [0, 0, 100, 0])
        stop()

        expect(onEnd).toHaveBeenCalledTimes(1)
    })

    test("a gesture that ends before measuring doesn't leave a pending move", async () => {
        const onMove = jest.fn()
        makePinchable(element, () => ({ onPinch: onMove }))

        pointer(element, "pointerdown", 1, 0, 0)
        pointer(element, "pointerdown", 2, 100, 0)
        pointer(window, "pointermove", 2, 150, 0)
        pointer(window, "pointerup", 1, 0, 0)
        pointer(window, "pointerup", 2, 0, 0)
        await nextFrame()

        const gesture = await twoFinger(element, [0, 0, 100, 0])
        await nextFrame()
        expect(onMove).not.toHaveBeenCalled()
        await gesture.end()
    })
})

describe("pinch with a trackpad: wheel deltas", () => {
    function wheelWithMode(deltaY: number, deltaMode: number) {
        const event = new Event("wheel", { bubbles: true, cancelable: true })
        Object.assign(event, {
            deltaY,
            deltaMode,
            clientX: 50,
            clientY: 0,
            ctrlKey: true,
        })
        element.dispatchEvent(event)
    }

    test("line deltas zoom as much as the equivalent pixels", async () => {
        makePinchable(element)

        wheelWithMode(-1, 1) // one line
        await nextFrame()
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(Math.exp(0.16))
    })

    test("a mouse wheel notch with ctrl zooms a step, not 2.7x", async () => {
        makePinchable(element)

        wheelWithMode(-100, 0)
        await nextFrame()
        await nextFrame()

        expect(value(element, "scale")).toBeCloseTo(Math.exp(0.5))
    })

    test("pinching past max doesn't build up", async () => {
        makePinchable(element, noop, { max: 2 })

        for (let i = 0; i < 2000; i++) wheelWithMode(-1e6, 0)
        await nextFrame()
        await nextFrame()
        expect(value(element, "scale")).toBe(2)

        await sleep(250)
        wheelWithMode(50, 0)
        await nextFrame()
        await nextFrame()
        expect(value(element, "scale")).toBeCloseTo(2 * Math.exp(-0.5))
    })
})
