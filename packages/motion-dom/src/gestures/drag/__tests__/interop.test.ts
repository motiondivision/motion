import { drag } from ".."
import { animateElement } from "../../../animation/animate/element"
import { animateLayout } from "../../../layout/animate-layout"
import { visualElementStore } from "../../../render/store"
import { acquireDragNode } from "../projection"
import { createElement, gesture, getValue, nextFrame, values } from "./utils"

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

function makeDraggable(...args: Parameters<typeof drag>) {
    const stop = drag(...args)
    stops.push(stop)
    return stop
}

/**
 * framer-motion's animate(element, ...) calls animateElement() with the
 * element's VisualElement from visualElementStore, if it has one. Call
 * it the same way here, as motion-dom can't import framer-motion.
 */
const animate = (
    element: HTMLElement,
    keyframes: Parameters<typeof animateElement>[1],
    transition?: Parameters<typeof animateElement>[2]
) =>
    Promise.all(
        animateElement(
            element,
            keyframes,
            transition,
            visualElementStore.get(element)
        )
    )

describe("drag() and animate()", () => {
    test("drag continues from a value animate() already set", async () => {
        const element = createElement()

        await animate(element, { x: 100 }, { duration: 0 })
        await nextFrame()
        expect(element.style.transform).toBe("translateX(100px)")

        makeDraggable(element, { momentum: false })

        const pointer = await gesture(element).to(50, 20)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: 150, y: 20 })
        expect(element.style.transform).toBe(
            "translateX(150px) translateY(20px)"
        )
    })

    test("animate() after a drag animates the same motion values", async () => {
        const element = createElement()
        makeDraggable(element, { momentum: false })

        const pointer = await gesture(element).to(100, 50)
        pointer.end()
        await nextFrame()

        const x = getValue(element, "x")!
        expect(x.get()).toBe(100)

        await animate(element, { x: 0, y: 0 }, { duration: 0.05 })
        await nextFrame()

        expect(getValue(element, "x")).toBe(x)
        expect(values(element)).toEqual({ x: 0, y: 0 })
        expect(element.style.transform).toBe("none")
    })

    test("drag starts from an animate() value mid-animation and stops it", async () => {
        const element = createElement()
        makeDraggable(element, { axis: "x", momentum: false })

        const [animation] = animateElement(
            element,
            { x: 500 },
            { duration: 5, ease: "linear" },
            visualElementStore.get(element)
        )

        await nextFrame()
        await nextFrame()

        const x = getValue(element, "x")!
        expect(x.isAnimating()).toBe(true)

        const pointer = gesture(element)
        const pressedX = x.get()
        expect(x.isAnimating()).toBe(false)
        expect(pressedX).toBeGreaterThan(0)

        await pointer.to(20, 0)
        pointer.end()
        await nextFrame()

        expect(x.get()).toBeCloseTo(pressedX + 20)
        expect(animation.state).not.toBe("running")
    })
})

describe("drag() and animateLayout()", () => {
    test("re-applying drag() after stop() mounts a fresh projection node", async () => {
        const element = createElement()
        drag(element)()

        makeDraggable(element, { momentum: false })

        const { projection } = visualElementStore.get(element)!
        expect(projection!.instance).toBe(element)

        const pointer = await gesture(element).to(30, 0)
        pointer.end()
        await nextFrame()

        expect(values(element).x).toBe(30)
    })

    test("drags an element animateLayout() already owns", async () => {
        const element = createElement()
        element.setAttribute("data-layout", "")

        await animateLayout(() => (element.style.width = "100px"), {
            duration: 0.05,
        })

        const visualElement = visualElementStore.get(element)!
        const node = visualElement.projection!
        expect(node).toBeDefined()

        const stop = drag(element, { momentum: false })

        /**
         * drag() shares the existing VisualElement and projection node
         * rather than creating its own.
         */
        expect(visualElementStore.get(element)).toBe(visualElement)
        expect(acquireDragNode(element)[0]).toBe(node)

        const pointer = await gesture(element).to(30, 40)
        pointer.end()
        await nextFrame()

        expect(values(element)).toEqual({ x: 30, y: 40 })
        expect(element.style.transform).toBe(
            "translateX(30px) translateY(40px)"
        )

        /**
         * Removing the gesture leaves animateLayout()'s node in place.
         */
        stop()
        expect(acquireDragNode(element)[0]).toBe(node)
        expect(node.instance).toBe(element)

        await animateLayout(() => (element.style.width = "200px"), {
            duration: 0.05,
        })
        await nextFrame()

        expect(element.style.width).toBe("200px")
        expect(values(element)).toEqual({ x: 30, y: 40 })
    })

    test("animateLayout() reuses the node of a draggable element", async () => {
        const element = createElement()
        element.setAttribute("data-layout", "")
        makeDraggable(element, { momentum: false })

        const visualElement = visualElementStore.get(element)!
        const node = visualElement.projection!

        let pointer = await gesture(element).to(50, 0)
        pointer.end()
        await nextFrame()

        await animateLayout(() => (element.style.width = "100px"), {
            duration: 0.05,
        })
        await nextFrame()

        expect(visualElementStore.get(element)).toBe(visualElement)
        expect(visualElement.projection).toBe(node)
        expect(values(element).x).toBe(50)

        /**
         * Dragging still works after the layout animation.
         */
        pointer = await gesture(element).to(10, 0)
        pointer.end()
        await nextFrame()

        expect(values(element).x).toBe(60)
    })

    test("upgrades a measurement-only drag node when animateLayout() runs later without top-level registration", async () => {
        let isolatedDrag!: typeof drag
        let isolatedAnimateLayout!: typeof animateLayout
        let isolatedStore!: typeof visualElementStore
        let isolatedProjection!: typeof import("../projection")
        let isolatedUtils!: typeof import("./utils")

        jest.isolateModules(() => {
            // Importing LayoutAnimationBuilder must not register layoutProjection.create as a side effect
            isolatedAnimateLayout =
                require("../../../layout/animate-layout").animateLayout
            isolatedProjection = require("../projection")
            isolatedDrag = require("..").drag
            isolatedStore = require("../../../render/store").visualElementStore
            isolatedUtils = require("./utils")
        })

        expect(isolatedProjection.layoutProjection.create).toBeUndefined()

        const element = isolatedUtils.createElement()
        element.setAttribute("data-layout", "")
        let left = 0
        element.getBoundingClientRect = () =>
            ({
                left,
                top: 0,
                width: 100,
                height: 100,
                right: left + 100,
                bottom: 100,
                x: left,
                y: 0,
            } as DOMRect)

        const stop = isolatedDrag(element, { momentum: false })
        stops.push(stop)

        const visualElement = isolatedStore.get(element)!
        const measureNode = visualElement.projection!
        expect((measureNode as any).upgrade).toBeDefined()

        // Start a drag gesture before animateLayout() has ever run
        const pointer = await isolatedUtils.gesture(element).to(40, 0)
        expect(isolatedUtils.values(element).x).toBe(40)
        expect(measureNode.isAnimationBlocked).toBe(true)

        // Trigger animateLayout() mid-drag: upgrades the node and preserves drag coordination
        await isolatedAnimateLayout(
            () => {
                left = 50
            },
            { duration: 0.05 }
        )
        await isolatedUtils.nextFrame()

        expect(isolatedProjection.layoutProjection.create).toBeDefined()
        const upgradedNode = visualElement.projection!
        expect(upgradedNode).not.toBe(measureNode)
        expect(upgradedNode.options.alwaysMeasureLayout).toBe(true)
        expect(upgradedNode.isAnimationBlocked).toBe(true)

        pointer.end()
        await isolatedUtils.nextFrame()

        // Dragging keeps working on the upgraded node
        const afterPointer = await isolatedUtils.gesture(element).to(10, 0)
        afterPointer.end()
        await isolatedUtils.nextFrame()
        expect(visualElement.projection).toBe(upgradedNode)

        // drag() owns the upgraded node, so stopping it releases the node
        stop()
        expect(upgradedNode.instance).toBeUndefined()
    })

    test("keeps a dragged parent without data-layout in the layout tree when animateLayout() runs later", async () => {
        let isolatedDrag!: typeof drag
        let isolatedAnimateLayout!: typeof animateLayout
        let builder!: typeof import("../../../layout/LayoutAnimationBuilder")
        let isolatedStore!: typeof visualElementStore
        let isolatedUtils!: typeof import("./utils")

        jest.isolateModules(() => {
            isolatedAnimateLayout =
                require("../../../layout/animate-layout").animateLayout
            builder = require("../../../layout/LayoutAnimationBuilder")
            isolatedDrag = require("..").drag
            isolatedStore = require("../../../render/store").visualElementStore
            isolatedUtils = require("./utils")
        })

        const parent = isolatedUtils.createElement()
        const child = document.createElement("div")
        child.setAttribute("data-layout", "")
        parent.appendChild(child)

        const stop = isolatedDrag(parent, { momentum: false })

        await isolatedAnimateLayout(parent, () => {}, { duration: 0.05 })
        await isolatedUtils.nextFrame()

        const parentNode = isolatedStore.get(parent)!.projection!
        expect((parentNode as any).upgrade).toBeUndefined()
        expect(builder.acquireProjectionNode(child)[0].parent).toBe(
            parentNode
        )

        // Stopping drag() releases the node it owns, as before
        stop()
        expect(parentNode.instance).toBeUndefined()
    })
})
