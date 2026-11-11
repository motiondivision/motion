import { styleSubjectEffect } from "../../../effects/style"
import { frame } from "../../../frameloop"
import { visualElementStore } from "../../../render/store"
import { drag } from "../../drag"
import { pinch } from "../../pinch"
import { getElementValues } from "../../utils/element-values"
import { constrain, createBounds, settleTransforms } from ".."

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

/**
 * Drag with a mouse-like pointer from (0, 0) to (x, 0) and release.
 */
async function dragTo(element: Element, x: number) {
    const event = (type: string, target: EventTarget, pageX: number) => {
        const e = new Event(type, { bubbles: true, cancelable: true })
        Object.assign(e, { isPrimary: true, button: 0, pageX, pageY: 0 })
        target.dispatchEvent(e)
    }
    event("pointerdown", element, 0)
    event("pointermove", document.body, 1)
    await nextFrame()
    event("pointermove", document.body, x)
    await nextFrame()
    event("pointerup", element, x)
}

const xOf = (element: Element) =>
    (visualElementStore.get(element)?.getValue("x")?.get() as number) ??
    (styleSubjectEffect.get(element as HTMLElement, "x")?.get() as number)

const scaleTo = (element: Element, scale: number) =>
    getElementValues(element)[0].set(scale)

const fixed = { elastic: 0, scale: false, rotate: false } as const
const stiff = { elastic: false, momentum: false } as const

describe("pinch constraints", () => {
    test("x/y resist past the constraints and spring back on release", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, {
                constraints: frameElement,
                scale: false,
                rotate: false,
            })
        )

        await pan(element, 200)
        // 100 inside, then 100 past it at 0.35
        expect(xOf(element)).toBeCloseTo(135)

        await lift()
        await sleep(1000)
        expect(xOf(element)).toBeCloseTo(100, 0)
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
        scaleTo(element, 2)

        await pan(element, 200)
        // At 2x the element can move 50px
        expect(xOf(element)).toBeCloseTo(50)

        await lift()
        await sleep(1000)
        expect(getElementValues(element)[0].get()).toBe(2)
        expect(xOf(element)).toBeCloseTo(50, 0)
    })
})

describe("drag constraintsType", () => {
    test("visual constraints follow the element's scale", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, {
                constraints: frameElement,
                constraintsType: "visual",
                ...stiff,
            })
        )
        scaleTo(element, 2)

        await dragTo(element, 300)
        expect(xOf(element)).toBe(50)
    })

    test("layout constraints ignore the scale", async () => {
        const { element, frameElement } = setup()
        stops.push(drag(element, { constraints: frameElement, ...stiff }))
        scaleTo(element, 2)

        await dragTo(element, 300)
        expect(xOf(element)).toBe(100)
    })
})

describe("shared constraints", () => {
    test("pinch uses drag's constraints", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, { constraints: frameElement, ...stiff }),
            pinch(element, fixed)
        )

        await pan(element, 200)
        expect(xOf(element)).toBeCloseTo(100)
        await lift()
    })

    test("drag uses pinch's constraints", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, { constraints: frameElement, ...fixed }),
            drag(element, stiff)
        )
        scaleTo(element, 2)

        // pinch's constraints are visual by default
        await dragTo(element, 300)
        expect(xOf(element)).toBe(50)
    })

    test("the constraints set last apply to both gestures", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, { constraints: { left: -10, right: 10 }, ...stiff }),
            pinch(element, { constraints: frameElement, ...fixed })
        )

        await dragTo(element, 300)
        expect(xOf(element)).toBe(100)

        const other = setup()
        stops.push(
            pinch(other.element, {
                constraints: other.frameElement,
                ...fixed,
            }),
            drag(other.element, {
                constraints: { left: -10, right: 10 },
                ...stiff,
            })
        )

        await pan(other.element, 200)
        expect(xOf(other.element)).toBeCloseTo(10)
        await lift()
    })

    test("constrain() sets the constraints of both gestures", async () => {
        const { element, frameElement } = setup()
        const bounds = constrain(element, frameElement)
        stops.push(drag(element, stiff), pinch(element, fixed))
        scaleTo(element, 2)

        expect(bounds.at({ scale: 2 }).right).toBe(50)

        await pan(element, 200)
        expect(xOf(element)).toBeCloseTo(50)
        await lift()

        await dragTo(element, 300)
        expect(xOf(element)).toBe(50)
    })

    test("constrain() replaces constraints set before", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, { constraints: { left: -10, right: 10 }, ...stiff })
        )
        constrain(element, frameElement)

        await dragTo(element, 300)
        expect(xOf(element)).toBe(100)
    })

    test("constraints only apply to gestures", async () => {
        const { element, frameElement } = setup()
        constrain(element, frameElement)
        stops.push(drag(element, stiff))

        getElementValues(element)[2].set(500)
        await nextFrame()
        expect(xOf(element)).toBe(500)
    })
})

describe("feedback from #4080", () => {
    test("an edge stays pinned while zooming out around the fingers", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, {
                constraints: frameElement,
                scale: { min: 1, max: 8 },
                rotate: false,
            })
        )
        const [scale, , x] = getElementValues(element)

        // 600px wide with its left edge at the frame's left edge
        scale.set(6)
        x.set(150)

        // Pinch from 6x to 4x around (100, 150), left of the centre
        pointer(element, "pointerdown", 1, 50, 150)
        pointer(element, "pointerdown", 2, 150, 150)
        await nextFrame()
        pointer(window, "pointermove", 1, 100 - 100 / 3, 150)
        pointer(window, "pointermove", 2, 100 + 100 / 3, 150)
        await nextFrame()

        expect(scale.get()).toBeCloseTo(4)

        /**
         * Around the fingers, x would be 83, past the 4x limit of 50.
         * The edge stays at the frame's edge instead.
         */
        expect(xOf(element)).toBeCloseTo(50)
        await lift()
    })

    test("a pinch starting past an edge carries on without a jump", async () => {
        const { element, frameElement } = setup()
        stops.push(
            pinch(element, {
                constraints: frameElement,
                scale: false,
                rotate: false,
            })
        )

        // Shown with elastic: 100 inside, then 100 past it at 0.35
        getElementValues(element)[2].set(135)

        await pan(element, 1)
        expect(xOf(element)).toBeCloseTo(135.35)
        await lift()
    })

    test("a drag released while a pinch settles aims for the settled limits", async () => {
        const { element, frameElement } = setup()
        stops.push(
            drag(element, {
                constraints: frameElement,
                constraintsType: "visual",
                elastic: false,
            })
        )

        // Springing back from 2.5x to 2x: the limits grow from 25 to 50
        scaleTo(element, 2.5)
        settleTransforms.set(element, { scale: 2, rotate: 0 })

        await dragTo(element, 300)
        expect(xOf(element)).toBe(25)

        await sleep(1500)
        expect(xOf(element)).toBeCloseTo(50, 0)
    })
})
