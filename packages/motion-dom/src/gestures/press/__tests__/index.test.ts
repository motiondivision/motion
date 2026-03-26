import { press } from ".."

function dispatchPointerEvent(target: EventTarget, type: string) {
    const event = new Event(type, {
        bubbles: true,
        cancelable: true,
    }) as PointerEvent

    Object.defineProperty(event, "isPrimary", { value: true })

    target.dispatchEvent(event)
}

describe("press", () => {
    test("handles pointer lifecycle in the current window", () => {
        const button = document.createElement("button")
        const onPressStart = jest.fn()
        const onPressEnd = jest.fn()

        document.body.appendChild(button)

        const cancel = press(button, () => {
            onPressStart()
            return onPressEnd
        })

        dispatchPointerEvent(button, "pointerdown")
        dispatchPointerEvent(button, "pointerup")

        expect(onPressStart).toHaveBeenCalledTimes(1)
        expect(onPressEnd).toHaveBeenCalledTimes(1)
        expect(onPressEnd).toHaveBeenCalledWith(
            expect.any(Event),
            expect.objectContaining({ success: true })
        )

        cancel()
        button.remove()
    })

    test("handles pointer lifecycle in an owning iframe window", () => {
        const iframe = document.createElement("iframe")
        const onPressStart = jest.fn()
        const onPressEnd = jest.fn()

        document.body.appendChild(iframe)

        const button = iframe.contentDocument!.createElement("button")
        iframe.contentDocument!.body.appendChild(button)

        const cancel = press(button, () => {
            onPressStart()
            return onPressEnd
        })

        dispatchPointerEvent(button, "pointerdown")
        dispatchPointerEvent(button, "pointerup")

        expect(onPressStart).toHaveBeenCalledTimes(1)
        expect(onPressEnd).toHaveBeenCalledTimes(1)
        expect(onPressEnd).toHaveBeenCalledWith(
            expect.any(Event),
            expect.objectContaining({ success: true })
        )

        cancel()
        iframe.remove()
    })
})
