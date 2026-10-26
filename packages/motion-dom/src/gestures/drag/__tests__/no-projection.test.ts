/**
 * drag() only needs to measure the element, so it mustn't load the layout
 * projection system unless animateLayout() is also in the bundle.
 */
jest.mock("../../../projection/node/create-projection-node", () => {
    throw new Error("drag() loaded the layout projection system")
})

import { drag } from ".."
import { visualElementStore } from "../../../render/store"
import { createElement, gesture, nextFrame, values } from "./utils"

afterEach(() => {
    document.body.innerHTML = ""
})

test("drag() works without the layout projection system", async () => {
    const container = createElement()
    const element = createElement("div", container)
    container.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 200, bottom: 200 } as DOMRect)
    element.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)

    const stop = drag(element, {
        constraints: container,
        elastic: 0,
        momentum: false,
    })
    await nextFrame()

    expect(visualElementStore.get(element)?.projection?.instance).toBe(element)

    const pointer = await gesture(element).to(1, 1)
    await pointer.to(500, 500)
    pointer.end()
    await nextFrame()

    expect(values(element)).toEqual({ x: 100, y: 100 })

    stop()
    expect(visualElementStore.get(element)?.projection?.instance).toBe(
        undefined
    )
})
