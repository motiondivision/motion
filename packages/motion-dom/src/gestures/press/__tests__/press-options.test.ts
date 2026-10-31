import { frame } from "../../../frameloop"
import { press } from "../index"
import type { OnPressEndEvent, PressHandlers } from "../types"
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

/**
 * `handlers` makes the start callback return an object of handlers,
 * with `onComplete` as the end callback, instead of a function.
 */
function setup(options = {}, count = 1, handlers?: PressHandlers) {
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
            const onEnd: OnPressEndEvent = (_, { success }) => {
                events.push((success ? "end:" : "cancel:") + element.id)
            }
            return handlers ? { ...handlers, onComplete: onEnd } : onEnd
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

    test("times: 2 starts on the first press and ends on the second", async () => {
        const { element, events } = setup({ times: 2 })

        pointer(element, "down")
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(true)
        await wait(50)
        pointer(element, "up")
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(false)

        await wait(100)
        pointer(element, "down")
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(true)
        await wait(50)
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
        expect(isPressing.has(element)).toBe(false)
    })

    test("times: 2 cancels if the second press is too slow", async () => {
        const { element, events } = setup({ times: 2 })

        await tap(element)
        await wait(400)
        await tap(element)

        expect(events).toEqual(["start:el0", "cancel:el0", "start:el0"])

        // The slow press starts a new sequence
        await wait(100)
        await tap(element)
        expect(events).toEqual([
            "start:el0",
            "cancel:el0",
            "start:el0",
            "end:el0",
        ])
    })

    test("times: 2 cancels once the interval expires", async () => {
        const { element, events } = setup({ times: 2 })

        await tap(element)
        await wait(200)
        await nextFrame()
        expect(events).toEqual(["start:el0"])

        await wait(150)
        await nextFrame()
        expect(events).toEqual(["start:el0", "cancel:el0"])
    })

    test("timesInterval sets the max gap between presses", async () => {
        const { element, events } = setup({ times: 2, timesInterval: 1 })

        await tap(element)
        await wait(800)
        await nextFrame()
        await tap(element)

        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("times: 2 cancels if the second press is far away", async () => {
        const { element, events } = setup({ times: 2 })

        await tap(element, 0, 0)
        await wait(50)
        await tap(element, 200, 0)

        expect(events).toEqual(["start:el0", "cancel:el0", "start:el0"])
    })

    test("a cancelled press cancels the sequence", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        pointer(element, "down")
        pointer(element, "cancel")
        expect(events).toEqual(["start:el0", "cancel:el0"])

        await wait(50)
        await tap(element)
        await wait(50)
        await tap(element)

        // Without the reset, this would be the third press
        expect(events).toEqual(["start:el0", "cancel:el0", "start:el0"])

        await wait(50)
        await tap(element)
        expect(events).toEqual([
            "start:el0",
            "cancel:el0",
            "start:el0",
            "end:el0",
        ])
    })

    test("a press released outside cancels the sequence", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        pointer(element, "down")
        pointer(document.body, "up")
        expect(events).toEqual(["start:el0", "cancel:el0"])

        await wait(50)
        await tap(element)
        await wait(50)
        await tap(element)

        expect(events).toEqual(["start:el0", "cancel:el0", "start:el0"])
    })

    test("times: 2 resets after the second press", async () => {
        const { element, events } = setup({ times: 2 })

        for (let i = 0; i < 4; i++) {
            await tap(element)
            await wait(50)
        }

        expect(events).toEqual(["start:el0", "end:el0", "start:el0", "end:el0"])
    })

    test("times: 3 succeeds on the third press only", async () => {
        const { element, events } = setup({ times: 3 })

        await tap(element)
        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0"])
        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0"])
        await wait(50)
        await tap(element)
        expect(events).toEqual(["start:el0", "end:el0", "start:el0"])
    })

    test("keyboard double press", async () => {
        const { element, events } = setup({ times: 2 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        expect(events).toEqual(["start:el0"])
        await wait(50)
        key(element, "keyup")
        expect(events).toEqual(["start:el0"])

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
        expect(events).toEqual(["start:el0", "start:el1"])

        await wait(50)
        await tap(a)
        expect(events).toEqual(["start:el0", "start:el1", "end:el0"])
        await wait(50)
        await tap(b)
        expect(events).toEqual(["start:el0", "start:el1", "end:el0", "end:el1"])
    })
})

describe("press after", () => {
    test("long press starts on press and succeeds after the hold time", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down")
        expect(events).toEqual(["start:el0"])
        expect(isPressing.has(element)).toBe(true)

        await wait(550)
        await nextFrame()
        expect(events).toEqual(["start:el0"])

        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
        expect(isPressing.has(element)).toBe(false)
    })

    test("early release cancels", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down")
        await wait(300)
        await nextFrame()
        pointer(element, "up")
        await wait(300)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual(["start:el0", "cancel:el0"])
    })

    test("moving past the tolerance cancels a long press", async () => {
        const { element, events } = setup({ after: 0.5 })

        pointer(element, "down", 0, 0)
        await wait(100)
        // Small movement within tolerance is fine
        pointer(element, "move", 3, 3)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        pointer(element, "move", 40, 0)
        expect(events).toEqual(["start:el0", "cancel:el0"])
        await wait(500)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual(["start:el0", "cancel:el0"])
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

    test("onHold reports hold progress, starting at 0", async () => {
        const progress: number[] = []
        const { element, events } = setup({ after: 0.5 }, 1, {
            onHold: (p) => progress.push(p),
        })

        pointer(element, "down")
        for (let i = 0; i < 3; i++) {
            await wait(100)
            await nextFrame()
        }
        pointer(element, "up")

        expect(events).toEqual(["start:el0", "cancel:el0"])
        expect(progress[0]).toBe(0)
        expect(progress.length).toBeGreaterThan(2)
        for (let i = 1; i < progress.length; i++) {
            expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1])
        }
        expect(progress[progress.length - 1]).toBeCloseTo(0.6)

        // Stops reporting once the press ends
        const count = progress.length
        await wait(100)
        await nextFrame()
        expect(progress.length).toBe(count)

        progress.length = 0
        pointer(element, "down")
        for (let i = 0; i < 6; i++) {
            await wait(100)
            await nextFrame()
        }
        expect(progress[progress.length - 1]).toBe(1)
        expect(progress.every((p) => p >= 0 && p <= 1)).toBe(true)

        // Stops reporting once complete
        const completeCount = progress.length
        await wait(100)
        await nextFrame()
        expect(progress.length).toBe(completeCount)
        pointer(element, "up")
        expect(progress.length).toBe(completeCount)
        expect(events).toEqual([
            "start:el0",
            "cancel:el0",
            "start:el0",
            "end:el0",
        ])
    })

    test("onHold is never called without after or repeat", async () => {
        const onHold = jest.fn()
        const { element } = setup({}, 1, { onHold })

        pointer(element, "down")
        await wait(100)
        await nextFrame()
        pointer(element, "up")

        expect(onHold).not.toHaveBeenCalled()
    })

    test("times and after: tap then hold", async () => {
        const progress: number[] = []
        const { element, events } = setup({ times: 2, after: 0.5 }, 1, {
            onHold: (p) => progress.push(p),
        })

        await tap(element)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        // No progress during the first, non-final press
        expect(progress).toEqual([])

        await wait(50)
        pointer(element, "down")
        await wait(600)
        await nextFrame()
        expect(progress[progress.length - 1]).toBe(1)
        expect(events).toEqual(["start:el0"])
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("times and after: early release of the final press cancels", async () => {
        const { element, events } = setup({ times: 2, after: 0.5 })

        await tap(element)
        await wait(50)
        await tap(element) // too short to count as the hold
        expect(events).toEqual(["start:el0", "cancel:el0"])

        await wait(50)
        pointer(element, "down")
        await wait(600)
        await nextFrame()

        // This is the first press of a new sequence
        expect(events).toEqual(["start:el0", "cancel:el0", "start:el0"])
    })

    test("keyboard hold counts and repeats don't restart it", async () => {
        const { element, events } = setup({ after: 0.5 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        expect(events).toEqual(["start:el0"])
        await wait(300)
        await nextFrame()
        key(element, "keydown") // auto-repeat
        await wait(300)
        await nextFrame()
        expect(events).toEqual(["start:el0"])
        key(element, "keyup")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("keyboard early release cancels", async () => {
        const { element, events } = setup({ after: 0.5 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        await wait(300)
        await nextFrame()
        key(element, "keyup")
        expect(events).toEqual(["start:el0", "cancel:el0"])
    })

    test("cancelling the gesture during a hold stops it", async () => {
        const onHold = jest.fn()
        const { element, events, cancel } = setup({ after: 0.5 }, 1, {
            onHold,
        })

        pointer(element, "down")
        cancel()
        await wait(600)
        await nextFrame()
        await nextFrame()

        expect(events).toEqual(["start:el0"])
        expect(onHold).not.toHaveBeenCalled()
    })
})

describe("press repeat", () => {
    test("repeats while held, drift-free", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ repeat: 0.1 }, 1, { onRepeat })

        pointer(element, "down")
        expect(events).toEqual(["start:el0"])

        await wait(50)
        await nextFrame()
        expect(onRepeat).not.toHaveBeenCalled()

        await wait(60)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
        expect(onRepeat).toHaveBeenLastCalledWith(1)

        await wait(100)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(2)
        expect(onRepeat).toHaveBeenLastCalledWith(2)

        pointer(element, "up")
        await wait(500)
        await nextFrame()
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(2)
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("after delays the first repeat", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ after: 0.5, repeat: 0.1 }, 1, {
            onRepeat,
        })

        pointer(element, "down")
        expect(events).toEqual(["start:el0"])
        await wait(510)
        await nextFrame()
        expect(onRepeat).not.toHaveBeenCalled()

        await wait(100)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("times: repeats only on the final press", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ times: 2, repeat: 0.1 }, 1, {
            onRepeat,
        })

        pointer(element, "down")
        await wait(110)
        await nextFrame()
        pointer(element, "up")
        expect(onRepeat).not.toHaveBeenCalled()

        await wait(50)
        pointer(element, "down")
        await wait(110)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(1)
        pointer(element, "up")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("movement past the tolerance cancels a repeating press", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ repeat: 0.1 }, 1, { onRepeat })

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

describe("press onHold", () => {
    /**
     * Log onHold and onRepeat calls in order.
     */
    const setupLog = (options: object) => {
        const log: string[] = []
        const result = setup(options, 1, {
            onHold: (p) => log.push("hold:" + p),
            onRepeat: (count) => log.push("repeat:" + count),
        })
        return { ...result, log }
    }

    test("after then repeat: 0 to 1 over after, then over each repeat", async () => {
        const { element, log } = setupLog({ after: 0.5, repeat: 0.2 })

        pointer(element, "down")
        await wait(250)
        await nextFrame()
        expect(log).toEqual(["hold:0"])

        await wait(250)
        await nextFrame()
        expect(log).toEqual(["hold:0", "hold:1"])

        // The frame after a boundary restarts at 0
        await wait(100)
        await nextFrame()
        await wait(50)
        await nextFrame()
        expect(log).toEqual(["hold:0", "hold:1", "hold:0", "hold:0.75"])

        // 1 at the boundary, before onRepeat
        await wait(50)
        await nextFrame()
        await wait(50)
        await nextFrame()
        await wait(100)
        await nextFrame()
        expect(log).toEqual([
            "hold:0",
            "hold:1",
            "hold:0",
            "hold:0.75",
            "hold:1",
            "repeat:1",
            "hold:0",
            "hold:0.75",
        ])

        pointer(element, "up")
        const count = log.length
        await wait(300)
        await nextFrame()
        expect(log.length).toBe(count)
    })

    test("repeat: loops from the start of the final press", async () => {
        const { element, log } = setupLog({ repeat: 0.1 })

        pointer(element, "down")
        await wait(10)
        await nextFrame()
        await wait(40)
        await nextFrame()
        await wait(50)
        await nextFrame()
        await wait(25)
        await nextFrame()
        await wait(25)
        await nextFrame()

        expect(log).toEqual([
            "hold:0",
            "hold:0.5",
            "hold:1",
            "repeat:1",
            "hold:0",
            "hold:0.5",
        ])
        pointer(element, "up")
    })

    test("times: only the final press reports", async () => {
        const { element, log } = setupLog({ times: 2, repeat: 0.1 })

        pointer(element, "down")
        await wait(150)
        await nextFrame()
        pointer(element, "up")
        expect(log).toEqual([])

        await wait(50)
        pointer(element, "down")
        await wait(50)
        await nextFrame()
        expect(log).toEqual(["hold:0"])
        pointer(element, "up")
    })

    test("after only: stays at 1 once reached", async () => {
        const { element, log } = setupLog({ after: 0.2 })

        pointer(element, "down")
        await wait(50)
        await nextFrame()
        await wait(200)
        await nextFrame()
        await wait(200)
        await nextFrame()

        expect(log).toEqual(["hold:0", "hold:1"])
        pointer(element, "up")
    })
})

describe("press onActive", () => {
    /**
     * Log every handler call in order.
     */
    const setupLog = (options: object) => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const log: string[] = []
        const cancel = press(
            element,
            () => {
                log.push("start")
                return {
                    onActive: () => log.push("active"),
                    onHold: (p) => log.push("hold:" + p),
                    onRepeat: (count) => log.push("repeat:" + count),
                    onComplete: (_, { success }) => {
                        log.push(success ? "end" : "cancel")
                    },
                }
            },
            options
        )
        return { element, log, cancel }
    }

    test("without after, fires on press down after start", async () => {
        const { element, log } = setupLog({})

        pointer(element, "down")
        expect(log).toEqual(["start", "active"])
        pointer(element, "up")
        expect(log).toEqual(["start", "active", "end"])
    })

    test("times: fires on the final press down", async () => {
        const { element, log } = setupLog({ times: 2 })

        await tap(element)
        expect(log).toEqual(["start"])
        await wait(50)
        pointer(element, "down")
        expect(log).toEqual(["start", "active"])
        pointer(element, "up")
        expect(log).toEqual(["start", "active", "end"])
    })

    test("after: fires after onHold(1) and before repeats", async () => {
        const { element, log } = setupLog({ after: 0.5, repeat: 0.2 })

        pointer(element, "down")
        await wait(250)
        await nextFrame()
        await wait(250)
        await nextFrame()
        await wait(100)
        await nextFrame()
        await wait(100)
        await nextFrame()
        pointer(element, "up")

        expect(log).toEqual([
            "start",
            "hold:0",
            "hold:1",
            "active",
            "hold:0",
            "hold:1",
            "repeat:1",
            "end",
        ])
    })

    test("repeat: fires once per gesture", async () => {
        const { element, log } = setupLog({ repeat: 0.1 })

        pointer(element, "down")
        await wait(110)
        await nextFrame()
        await wait(100)
        await nextFrame()
        pointer(element, "up")

        expect(log.filter((entry) => entry === "active")).toEqual(["active"])
        expect(log[1]).toBe("active")
    })

    test("doesn't fire if released before after", async () => {
        const { element, log } = setupLog({ after: 0.5 })

        pointer(element, "down")
        await wait(300)
        await nextFrame()
        pointer(element, "up")
        await wait(300)
        await nextFrame()

        expect(log).toEqual(["start", "hold:0", "cancel"])
    })

    test("doesn't fire for an unfinished times sequence", async () => {
        const { element, log } = setupLog({ times: 2 })

        await tap(element)
        await wait(400)
        await nextFrame()

        expect(log).toEqual(["start", "cancel"])
    })

    test("doesn't fire if the gesture is cancelled during a hold", async () => {
        const { element, log, cancel } = setupLog({ after: 0.5 })

        pointer(element, "down")
        cancel()
        await wait(600)
        await nextFrame()

        expect(log).toEqual(["start"])
    })

    test("keyboard: fires on keydown without after", async () => {
        const { element, log } = setupLog({})
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        expect(log).toEqual(["start", "active"])
        key(element, "keyup")
        expect(log).toEqual(["start", "active", "end"])
    })

    test("keyboard: fires once after is reached", async () => {
        const { element, log } = setupLog({ after: 0.5 })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        await wait(300)
        await nextFrame()
        key(element, "keydown") // auto-repeat
        await wait(300)
        await nextFrame()
        key(element, "keyup")

        expect(log).toEqual(["start", "hold:0", "hold:1", "active", "end"])
    })
})

describe("press start return value", () => {
    /**
     * Record every end call, with its arguments, for each return form.
     */
    function setupForms(options = {}) {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const calls: { fn: any[][]; object: any[][] } = { fn: [], object: [] }

        press(
            element,
            () =>
                (...args) => {
                    calls.fn.push(args)
                },
            options
        )
        press(
            element,
            () => ({
                onComplete: (...args) => {
                    calls.object.push(args)
                },
            }),
            options
        )

        return { element, calls }
    }

    const expectEquivalent = (
        calls: { fn: any[][]; object: any[][] },
        success: boolean[]
    ) => {
        const infos = success.map((s) => ({ success: s }))
        expect(calls.fn.map(([, info]) => info)).toEqual(infos)
        expect(calls.object.map(([, info]) => info)).toEqual(infos)
        // Compared by identity, as printing a DOM event diff crashes Jest
        const sameEvents = calls.object.every(
            ([event], i) => event === calls.fn[i][0]
        )
        expect(sameEvents).toBe(true)
    }

    test("onComplete is equivalent to returning a function: success", async () => {
        const { element, calls } = setupForms()

        await tap(element)

        expectEquivalent(calls, [true])
    })

    test("onComplete is equivalent to returning a function: cancel", async () => {
        const { element, calls } = setupForms()

        pointer(element, "down")
        pointer(element, "cancel")
        pointer(element, "down")
        pointer(document.body, "up")

        expectEquivalent(calls, [false, false])
    })

    test("onComplete is equivalent to returning a function: keyboard", async () => {
        const { element, calls } = setupForms()
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        key(element, "keyup")
        key(element, "keydown")
        element.dispatchEvent(new FocusEvent("blur"))

        expectEquivalent(calls, [true, false])
    })

    test("onComplete is equivalent to returning a function: times and after", async () => {
        const { element, calls } = setupForms({ times: 2, after: 0.5 })

        await tap(element)
        expect(calls.fn).toEqual([])
        await wait(50)
        pointer(element, "down")
        await wait(600)
        await nextFrame()
        pointer(element, "up")

        expectEquivalent(calls, [true])
    })

    test("returning nothing still works", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const onPressStart = jest.fn()
        press(element, onPressStart, { repeat: 0.1 })

        pointer(element, "down")
        expect(isPressing.has(element)).toBe(true)
        await wait(250)
        await nextFrame()
        pointer(element, "up")
        expect(isPressing.has(element)).toBe(false)

        pointer(element, "down")
        pointer(element, "cancel")
        expect(onPressStart).toHaveBeenCalledTimes(2)
    })

    test("returning an empty object still works", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        press(element, () => ({}), { repeat: 0.1 })

        pointer(element, "down")
        await wait(250)
        await nextFrame()
        pointer(element, "up")
        expect(isPressing.has(element)).toBe(false)
    })

    test("onRepeat fires for a keyboard press", async () => {
        const onRepeat = jest.fn()
        const { element, events } = setup({ repeat: 0.1 }, 1, { onRepeat })
        element.dispatchEvent(new FocusEvent("focus"))

        key(element, "keydown")
        await wait(110)
        await nextFrame()
        key(element, "keydown") // auto-repeat
        await wait(100)
        await nextFrame()
        expect(onRepeat).toHaveBeenCalledTimes(2)
        key(element, "keyup")
        expect(events).toEqual(["start:el0", "end:el0"])
    })

    test("each press gets its own handlers", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const repeats: string[] = []
        let presses = 0
        press(
            element,
            () => {
                const id = ++presses
                return { onRepeat: (count) => repeats.push(id + ":" + count) }
            },
            { repeat: 0.1 }
        )

        pointer(element, "down")
        await wait(110)
        await nextFrame()
        pointer(element, "up")
        pointer(element, "down")
        await wait(110)
        await nextFrame()
        pointer(element, "up")

        expect(repeats).toEqual(["1:1", "2:1"])
    })
})
