import { drag } from ".."
import { press } from "../../press"
import { isPressing } from "../../press/utils/state"
import { createElement, gesture, nextFrame, pointer } from "./utils"

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

const tap = (element: Element) => {
    pointer(element, "pointerdown")
    pointer(element, "pointerup")
}

function setup() {
    const element = createElement()
    const events: string[] = []

    stops.push(drag(element, { momentum: false }))
    stops.push(
        press(
            element,
            () => {
                events.push("start")
                return (_, { success }) =>
                    events.push(success ? "end" : "cancel")
            },
            { count: 3 }
        )
    )

    return { element, events }
}

describe("press({ count }) and drag() on the same element", () => {
    test("a drag during a count sequence cancels it", async () => {
        const { element, events } = setup()

        tap(element)
        await nextFrame()
        expect(events).toEqual(["start"])

        const drag = await gesture(element).to(50, 0)
        await drag.to(60, 0)

        // Cancelled as soon as the drag starts, not on release
        expect(events).toEqual(["start", "cancel"])
        expect(isPressing.has(element)).toBe(false)

        drag.end()
        await nextFrame()

        expect(events).toEqual(["start", "cancel"])
        expect(isPressing.has(element)).toBe(false)

        // A third tap doesn't complete the cancelled sequence
        tap(element)
        await nextFrame()
        expect(events).toEqual(["start", "cancel", "start"])
    })

    test("a full count sequence after a drag succeeds", async () => {
        const { element, events } = setup()

        const drag = await gesture(element).to(50, 0)
        await drag.to(60, 0)
        drag.end()
        await nextFrame()
        expect(events).toEqual(["start", "cancel"])
        events.length = 0

        tap(element)
        tap(element)
        tap(element)
        await nextFrame()

        expect(events).toEqual(["start", "end"])
    })
})
