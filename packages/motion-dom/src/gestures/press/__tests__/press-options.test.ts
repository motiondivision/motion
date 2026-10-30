import { frame } from "../../../frameloop"
import { press } from "../index"
import { isPressing } from "../utils/state"

if (typeof (globalThis as any).PointerEvent === "undefined") {
    ;(globalThis as any).PointerEvent = class extends MouseEvent {
        isPrimary: boolean
        constructor(type: string, init: any = {}) {
            super(type, init)
            this.isPrimary = init.isPrimary ?? true
        }
    }
}

let now = 0
let nowSpy: jest.SpyInstance

beforeEach(() => {
    now = 1000
    nowSpy = jest.spyOn(performance, "now").mockImplementation(() => now)
})

afterEach(() => {
    nowSpy.mockRestore()
    document.body.innerHTML = ""
})

/**
 * Advance mocked time and let the cached `time.now()` value clear.
 */
const wait = async (ms: number) => {
    now += ms
    await Promise.resolve()
}

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const pointer = (
    target: EventTarget,
    type: "down" | "up" | "cancel" | "move",
    x = 0,
    y = 0
) =>
    target.dispatchEvent(
        new PointerEvent("pointer" + type, {
            isPrimary: true,
            bubbles: true,
            clientX: x,
            clientY: y,
        })
    )

const key = (element: Element, type: "keydown" | "keyup") =>
    element.dispatchEvent(new KeyboardEvent(type, { key: "Enter" }))

function setup(options = {}, count = 1) {
    const elements: HTMLElement[] = []
    const events: string[] = []

    for (let i = 0; i < count; i++) {
        const element = document.createElement("div")
        element.id = "el" + i
        document.body.appendChild(element)
        elements.push(element)
    }

    const cancel = press(
        elements,
        (element) => {
            events.push("start:" + element.id)
            return (_, { success }) =>
                events.push((success ? "end:" : "cancel:") + element.id)
        },
        options
    )

    return { elements, element: elements[0], events, cancel }
}

/**
 * A full press: pointerdown then pointerup on the element.
 */
const tap = async (element: Element, x = 0, y = 0) => {
    pointer(element, "down", x, y)
    await wait(50)
    pointer(element, "up", x, y)
}

describe("press times", () => {
    test("default fires on every press", async () => {
        const { element, events } = setup()

        await tap(element)
        await tap(element)

        expect(events).toEqual(["start:el0", "end:el0", "start:el0", "end:el0"])
    })

    test("times: 1 fires on every press", async () => {
        const { element, events } = setup({ times: 1 })

        await tap(element)
        await wait(50)
        await tap(element)

        expect(events).toEqual(["start:el0", "end:el0", "start:el0", "end:el0"])
    })

    test("times: 2 fires only on the second quick press", async () => {
        const { element, events } = setup({ times: 2 })

        pointer(element, "down")
        expect(isPressing.has(element)).toBe(false)
        await wait(50)
        pointer(element, "up")
        expect(events).toEqual([])

        await wait(100)
        pointer(element, "down")
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(true)
        await wait(50)
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
        expect(isPressing.has(element)).toBe(false)
    })

    test("times: 2 doesn't fire if the second press is too slow", async () => {
        const { element, events } = setup({ times: 2 })

        await tap(element)
        await wait(400)
        await tap(element)

        expect(events).toEqual([])

        // But the slow press starts a new sequence
        await wait(100)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("timesInterval sets the max gap between presses", async () => {
        const { element, events } = setup({ times: 2, timesInterval: 1 })

        await tap(element)
        await wait(800)
        await tap(element)

        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("times: 2 doesn't fire if the second press is far away", async () => {
        const { element, events } = setup({ times: 2 })

        await tap(element, 0, 0)
        await wait(50)
        await tap(element, 200, 0)

        expect(events).toEqual([])
    })

    test("a cancelled press resets the sequence", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        pointer(element, "down")
        pointer(element, "cancel")
        await wait(50)
        await tap(element)
        await wait(50)
        await tap(element)

        // Without the reset, this would be the third press
        expect(events).toEqual([])

        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("a press released outside resets the sequence", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        pointer(element, "down")
        pointer(document.body, "up")
        await wait(50)
        await tap(element)
        await wait(50)
        await tap(element)

        expect(events).toEqual([])
    })

    test("times: 2 resets after the second press", async () => {
        const { element, events } = setup({ times: 2 })

        for (let i = 0; i < 4; i++) {
            await tap(element)
            await wait(50)
        }

        expect(events).toEqual(["start:el0", "end:el0", "start:el0", "end:el0"])
    })

    test("times: 3 fires on the third press only", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        await tap(element)
        expect(events).toEqual([])
        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0"])
        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("keyboard double press", async () => {
        const { element, events } = setup({ times: 2 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        await wait(50)
        key(element, "keyup")
        expect(events).toEqual([])

        await wait(50)
        key(element, "keydown")
        await wait(50)
        key(element, "keyup")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("counts presses per element", async () => {
        const { elements, events } = setup({ times: 2 }, 2)
        const [a, b] = elements

        await tap(a)
        await wait(50)
        await tap(b)
        expect(events).toEqual([])

        await wait(50)
        await tap(a)
        expect(events).toEqual(["start:el0", "end:el0"])
        await wait(50)
        await tap(b)
        expect(events).toEqual([
            "start:el0",
            "end:el0",
            "start:el1",
            "end:el1",
        ])
    })
})

describe("press after", () => {
    test("long press starts after the hold time", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down")
        await nextFrame()
        expect(events).toEqual([])
        expect(isPressing.has(element)).toBe(false)

        await wait(300)
        await nextFrame()
        expect(events).toEqual([])

        await wait(250)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(true)

        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("early release doesn't fire", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down")
        await wait(300)
        await nextFrame()
        pointer(element, "up")
        await wait(300)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual([])
    })

    test("moving past the tolerance cancels a long press", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down", 0, 0)
        await wait(100)
        // Small movement within tolerance is fine
        pointer(element, "move", 3, 3)
        await nextFrame()
        pointer(element, "move", 40, 0)
        await wait(500)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual([])
    })

    test("prevents the context menu during a long press", async () => {
        const { element } = setup({ after: 0.5 })

        const menu = () => {
            const event = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
            })
            element.dispatchEvent(event)
            return event.defaultPrevented
        }

        expect(menu()).toBe(false)
        pointer(element, "down")
        expect(menu()).toBe(true)
        pointer(element, "up")
        expect(menu()).toBe(false)
    })

    test("onProgress reports hold progress and resets on cancel", async () => {
        const progress: number[] = []
        const { element, events } = setup({
            after: 0.5,
            onProgress: (p: number) => progress.push(p),
        })

        pointer(element, "down")
        for (let i = 0; i < 3; i++) {
            await wait(100)
            await nextFrame()
        }
        pointer(element, "up")

        expect(events).toEqual([])
        expect(progress.length).toBeGreaterThan(2)
        const held = progress.slice(0, -1)
        for (let i = 1; i < held.length; i++) {
            expect(held[i]).toBeGreaterThanOrEqual(held[i - 1])
        }
        expect(held[held.length - 1]).toBeCloseTo(0.6)
        expect(progress[progress.length - 1]).toBe(0)

        progress.length = 0
        pointer(element, "down")
        for (let i = 0; i < 6; i++) {
            await wait(100)
            await nextFrame()
        }
        expect(progress[progress.length - 1]).toBe(1)
        expect(progress.every((p) => p >= 0 && p <= 1)).toBe(true)
        expect(events).toEqual(["start:el0"])

        const count = progress.length
        await wait(100)
        await nextFrame()
        // Stops reporting once started
        expect(progress.length).toBe(count)
        pointer(element, "up")
        expect(progress.length).toBe(count)
    })

    test("no frames are scheduled without after", async () => {
        const onProgress = jest.fn()
        const { element } = setup({ onProgress })

        pointer(element, "down")
        await wait(100)
        await nextFrame()
        pointer(element, "up")

        expect(onProgress).not.toHaveBeenCalled()
    })

    test("times and after: tap then hold", async () => {
        const progress: number[] = []
        const { element, events } = setup({
            times: 2,
            after: 0.5,
            onProgress: (p: number) => progress.push(p),
        })

        await tap(element)
        await nextFrame()
        // No progress during the first, non-final press
        expect(progress).toEqual([])

        await wait(50)
        pointer(element, "down")
        await wait(600)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("times and after: early release of the final press resets", async () => {
        const { element, events } = setup({ times: 2, after: 0.5 })

        await tap(element)
        await wait(50)
        await tap(element) // too short to count as the hold
        await wait(50)
        pointer(element, "down")
        await wait(600)
        await nextFrame()

        // This is the first press of a new sequence
        expect(events).toEqual([])
    })

    test("keyboard hold counts and repeats don't restart it", async () => {
        const { element, events } = setup({ after: 0.5 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        await wait(300)
        await nextFrame()
        key(element, "keydown") // auto-repeat
        await wait(300)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        key(element, "keyup")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("cancelling the gesture during a hold stops it", async () => {
        const { element, events, cancel } = setup({ after: 0.5 })

        pointer(element, "down")
        cancel()
        await wait(600)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual([])
    })
})

describe("press repeat", () => {
    test("repeats while held, drift-free", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ repeat: 0.1, onRepeat })

        pointer(element, "down")
        expect(events).toEqual(["start:el0"])

        await wait(50)
        await nextFrame()
        expect(onRepeat).not.toHaveBeenCalled()

        await wait(60)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
        expect(onRepeat).toHaveBeenLastCalledWith(
            element,
            expect.anything(),
            1
        )

        await wait(100)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(2)
        expect(onRepeat).toHaveBeenLastCalledWith(
            element,
            expect.anything(),
            2
        )

        pointer(element, "up")
        await wait(500)
        await nextFrame()
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(2)
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("after delays the press and so the first repeat", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({
            after: 0.5,
            repeat: 0.1,
            onRepeat,
        })

        pointer(element, "down")
        await wait(510)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        expect(onRepeat).not.toHaveBeenCalled()

        await wait(100)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
        pointer(element, "up")
    })

    test("movement past the tolerance cancels a repeating press", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ repeat: 0.1, onRepeat })

        pointer(element, "down", 0, 0)
        await wait(110)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)

        pointer(element, "move", 50, 0)
        expect(events).toEqual(["start:el0", "cancel:el0"])
        await wait(300)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
    })
})
