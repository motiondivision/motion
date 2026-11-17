/**
 * drag() renders a plain element with the element's node, which
 * animate() and styleEffect() share. It mustn't load VisualElement,
 * which only motion components need.
 */
jest.mock("../../../render/VisualElement", () => {
    throw new Error("drag() loaded VisualElement")
})

import { drag } from ".."
import { animateElement } from "../../../animation/animate/element"
import { nodeStore } from "../../../render/store"
import { motionValue } from "../../../value"
import { createElement, gesture, nextFrame, values } from "./utils"

afterEach(() => {
    document.body.innerHTML = ""
})

test("drag() works without VisualElement", async () => {
    const element = createElement()
    element.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)

    const stop = drag(element, { momentum: false })
    await nextFrame()

    const pointer = await gesture(element).to(1, 1)
    await pointer.to(51, 21)
    pointer.end()
    await nextFrame()

    expect(values(element)).toEqual({ x: 51, y: 21 })
    stop()
})

test("drag() takes over the values animate() gave the element", async () => {
    const element = createElement()
    element.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)

    animateElement(element, { opacity: 0.5 }, { duration: 0 })
    const opacity = nodeStore.get(element)!.getValue("opacity")

    const stop = drag(element, { momentum: false })
    const node = nodeStore.get(element)!

    expect(node.getValue("opacity")).toBe(opacity)
    expect(opacity!.owner).toBe(node)

    /**
     * animate() then reaches the same node, so a drag and an animation
     * write one transform.
     */
    const x = motionValue(0)
    node.addValue("x", x)
    animateElement(element, { x: 20 }, { duration: 0 })
    expect(nodeStore.get(element)).toBe(node)
    expect(node.getValue("x")).toBe(x)

    stop()
})
