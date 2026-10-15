import { drag } from ".."
import { frame } from "../../../frameloop"
import { visualElementStore } from "../../../render/store"

function pointer(target: EventTarget, type: string, pageX = 0, pageY = 0) {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { isPrimary: true, button: 0, pageX, pageY })
    target.dispatchEvent(event)
}

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

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

describe("drag", () => {
    let element: HTMLElement

    beforeEach(() => {
        element = document.createElement("div")
        document.body.appendChild(element)
    })

    afterEach(() => element.remove())

    test("moves the element with the pointer", async () => {
        const stop = drag(element, { momentum: false })

        await dragTo(element, 100, 50)

        expect(element.style.transform).toBe(
            "translateX(100px) translateY(50px)"
        )

        await release(element)
        stop()
    })

    test("locks to an axis", async () => {
        const stop = drag(element, { axis: "x", momentum: false })

        await dragTo(element, 100, 50)

        expect(element.style.transform).toBe("translateX(100px)")

        await release(element)
        stop()
    })

    test("applies pixel constraints", async () => {
        const stop = drag(element, {
            constraints: { left: 0, right: 50 },
            elastic: 0,
            momentum: false,
        })

        await dragTo(element, 100, 0)

        const x = visualElementStore.get(element)!.getValue("x")!
        expect(x.get()).toBe(50)

        await release(element)
        stop()
    })

    test("fires lifecycle callbacks", async () => {
        const onStart = jest.fn()
        const onMove = jest.fn()
        const onEnd = jest.fn()

        const stop = drag(element, {
            momentum: false,
            onStart,
            onMove,
            onEnd,
        })

        await dragTo(element, 20, 0)
        await release(element, 20, 0)

        expect(onStart).toHaveBeenCalledTimes(1)
        expect(onMove).toHaveBeenCalled()
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].offset).toEqual({ x: 20, y: 0 })

        stop()
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
})
