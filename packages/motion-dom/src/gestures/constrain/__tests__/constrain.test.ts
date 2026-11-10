import { styleSubjectEffect } from "../../../effects/style"
import { frame } from "../../../frameloop"
import { visualElementStore } from "../../../render/store"
import { drag } from "../../drag"
import { pinch } from "../../pinch"
import { getElementValues } from "../../utils/element-values"
import { constrain, createBounds } from ".."

const xy = (element: Element) => () => {
    const [, , x, y] = getElementValues(element)
    return [x.get(), y.get()] as [number, number]
}

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

const rect = (left: number, top: number, width: number, height: number) =>
    ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON() {},
    } as DOMRect)

/**
 * JSDOM has no layout. Give the element a layout box of width x height
 * centred on (cx, cy), moved by its x/y motion values as a browser's
 * would be. Its drawn size doesn't matter, as constraints read the
 * layout size from offsetWidth/offsetHeight.
 */
function layout(
    element: HTMLElement,
    cx: number,
    cy: number,
    width = 100,
    height = width
) {
    const px = (key: string) =>
        parseFloat(
            ((visualElementStore.get(element)?.getValue(key)?.get() as
                | number
                | undefined) ??
                (styleSubjectEffect.get(element, key)?.get() as
                    | number
                    | undefined) ??
                0) as any
        ) || 0

    Object.defineProperty(element, "offsetWidth", {
        value: width,
        configurable: true,
    })
    Object.defineProperty(element, "offsetHeight", {
        value: height,
        configurable: true,
    })
    element.getBoundingClientRect = () =>
        rect(cx + px("x") - width / 2, cy + px("y") - height / 2, width, height)
}

/**
 * A 300 x 300 frame at the origin, with a 100 x 100 element centred in it.
 */
function setup() {
    const frameElement = document.createElement("div")
    const element = document.createElement("div")
    frameElement.appendChild(element)
    document.body.appendChild(frameElement)
    frameElement.getBoundingClientRect = () => rect(0, 0, 300, 300)
    layout(element, 150, 150)
    return { frameElement, element }
}

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
}

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

describe("createBounds", () => {
    test("measures the layout box at scale 1", () => {
        const { element, frameElement } = setup()
        const bounds = createBounds(
            element,
            frameElement,
            "visual",
            xy(element)
        )

        expect(bounds.at()).toEqual({
            left: -100,
            right: 100,
            top: -100,
            bottom: 100,
        })
    })

    test("visual constraints follow the scale", () => {
        const { element, frameElement } = setup()
        const bounds = createBounds(
            element,
            frameElement,
            "visual",
            xy(element)
        )

        // 200px wide in a 300px frame
        expect(bounds.at({ scale: 2 }).left).toBe(-50)
        expect(bounds.at({ scale: 2 }).right).toBe(50)

        // Exactly fills the frame
        expect(bounds.at({ scale: 3 }).left).toBe(0)
        expect(bounds.at({ scale: 3 }).right).toBe(0)

        // 500px wide: covers the frame, so the limits flip
        expect(bounds.at({ scale: 5 })).toEqual({
            left: -100,
            right: 100,
            top: -100,
            bottom: 100,
        })
    })

    test("layout constraints ignore the scale", () => {
        const { element, frameElement } = setup()
        const bounds = createBounds(
            element,
            frameElement,
            "layout",
            xy(element)
        )

        expect(bounds.at({ scale: 2 }).right).toBe(100)
    })

    test("visual constraints measure the box around a rotated element", () => {
        const { element, frameElement } = setup()
        layout(element, 150, 150, 200, 100)
        const bounds = createBounds(
            element,
            frameElement,
            "visual",
            xy(element)
        )

        expect(bounds.at().right).toBe(50)
        expect(bounds.at().bottom).toBe(100)

        // Turned on its side: 100 wide, 200 tall
        const turned = bounds.at({ rotate: 90 })
        expect(turned.right).toBeCloseTo(100)
        expect(turned.bottom).toBeCloseTo(50)
    })

    test("measures from where the element is", () => {
        const { element, frameElement } = setup()
        const [, , x] = getElementValues(element)
        x.set(40)

        // The layout box is still centred, so the limits don't change
        expect(
            createBounds(element, frameElement, "visual", xy(element)).at()
                .right
        ).toBe(100)
    })

    test("passes boxes through, and calls functions with the transform", () => {
        const { element } = setup()

        expect(
            createBounds(element, { left: -10 }, "visual", xy(element)).at()
        ).toEqual({
            left: -10,
        })
        expect(
            createBounds(
                element,
                ({ scale }) => ({ right: scale * 10 }),
                "visual",
                xy(element)
            ).at({
                scale: 3,
            })
        ).toEqual({ right: 30 })
    })
})

describe("constrain", () => {
    test("moves the element back inside when its scale changes", async () => {
        const { element, frameElement } = setup()
        const [scale, , x] = getElementValues(element)
        const bounds = constrain(element, frameElement)
        stops.push(bounds.stop)
        await nextFrame()

        scale.set(5)
        x.set(100)
        await nextFrame()
        expect(x.get()).toBe(100)

        // Zooming out shrinks how far it can move
        scale.set(2)
        await nextFrame()
        expect(x.get()).toBe(50)
    })

    test("leaves x/y alone while held", async () => {
        const { element, frameElement } = setup()
        const [, , x] = getElementValues(element)
        const bounds = constrain(element, frameElement)
        stops.push(bounds.stop)
        await nextFrame()

        const release = bounds.hold()
        x.set(500)
        await nextFrame()
        expect(x.get()).toBe(500)

        // Released, it springs back inside
        release()
        await nextFrame()
        await nextFrame()
        // Springing, rather than jumping
        expect(x.get()).toBeLessThan(500)
        expect(x.get()).toBeGreaterThan(100)
        await sleep(1500)
        expect(x.get()).toBeCloseTo(100, 0)
    })

    test("stop() stops constraining", async () => {
        const { element, frameElement } = setup()
        const [, , x] = getElementValues(element)
        const bounds = constrain(element, frameElement)
        await nextFrame()
        bounds.stop()

        x.set(500)
        await nextFrame()
        expect(x.get()).toBe(500)
    })
})

describe("pinch constraints", () => {
    async function pan(element: Element, dx: number) {
        pointer(element, "pointerdown", 1, 100, 150)
        pointer(element, "pointerdown", 2, 200, 150)
        await nextFrame()
        pointer(window, "pointermove", 1, 100 + dx, 150)
        pointer(window, "pointermove", 2, 200 + dx, 150)
        await nextFrame()
    }

    async function lift() {
        pointer(window, "pointerup", 1, 0, 0)
        pointer(window, "pointerup", 2, 0, 0)
        await nextFrame()
    }

    test("x/y resist past the constraints and spring back on release", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, {
                constraints: frameElement,
                scale: false,
                rotate: false,
            })
        )
        const [, , x] = getElementValues(element)

        await pan(element, 200)
        // 100 inside, then 100 past it at 0.35
        expect(x.get()).toBeCloseTo(135)

        await lift()
        await sleep(1000)
        expect(x.get()).toBeCloseTo(100, 0)
    })

    test("springs inside the constraints at the scale it settles at", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, {
                constraints: frameElement,
                scale: { min: 1, max: 2 },
                rotate: false,
                elastic: 0,
            })
        )
        const [scale, , x] = getElementValues(element)
        scale.set(2)

        await pan(element, 200)
        // At 2x the element can move 50px
        expect(x.get()).toBeCloseTo(50)

        await lift()
        await sleep(1000)
        expect(scale.get()).toBe(2)
        expect(x.get()).toBeCloseTo(50, 0)
    })

    test("shares constraints with drag and holds constrain()", async () => {
        const { element, frameElement } = setup()
        const bounds = constrain(element, frameElement)
        stops.push(bounds.stop)
        stops.push(
            drag(element, { constraints: bounds, momentum: false }),
            pinch(element, {
                constraints: bounds,
                scale: false,
                rotate: false,
            })
        )
        await nextFrame()
        const x = visualElementStore.get(element)!.getValue("x")!

        await pan(element, 200)
        expect(x.get()).toBeGreaterThan(100)

        await lift()
        await sleep(1000)
        expect(x.get()).toBeCloseTo(100, 0)
    })
})

describe("drag constraintsType", () => {
    function dragBy(element: Element) {
        const event = (type: string, target: EventTarget, pageX: number) => {
            const e = new Event(type, { bubbles: true, cancelable: true })
            Object.assign(e, { isPrimary: true, button: 0, pageX, pageY: 0 })
            target.dispatchEvent(e)
        }
        event("pointerdown", element, 0)
        return {
            to: async (x: number) => {
                event("pointermove", document.body, x)
                await nextFrame()
            },
            end: (x: number) => event("pointerup", element, x),
        }
    }

    test("visual constraints follow the element's scale", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, {
                constraints: frameElement,
                constraintsType: "visual",
                elastic: false,
                momentum: false,
            })
        )
        visualElementStore.get(element)!.getValue("scale", 1).set(2)

        const gesture = dragBy(element)
        await gesture.to(1)
        await gesture.to(300)
        gesture.end(300)

        expect(visualElementStore.get(element)!.getValue("x")!.get()).toBe(50)
    })
})
