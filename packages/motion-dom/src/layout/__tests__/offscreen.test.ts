import { animateLayout } from "../.."
import { frame } from "../../frameloop"
import { visualElementStore } from "../../render/store"

const getNode = (element: Element) =>
    visualElementStore.get(element)?.projection

/**
 * JSDOM's viewport is 1024 x 768 at scroll 0. Elements are positioned by
 * mocking getBoundingClientRect, and moved by updateDom.
 */
interface Rect {
    x: number
    y: number
    width?: number
    height?: number
}

function createElement(rect: Rect, parent: HTMLElement = document.body) {
    const element = document.createElement("div")
    element.setAttribute("data-layout", "")
    let current = rect
    element.getBoundingClientRect = () => {
        const { x, y, width = 100, height = 100 } = current
        return {
            x,
            y,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            width,
            height,
            toJSON: () => ({}),
        } as DOMRect
    }
    parent.appendChild(element)
    return { element, moveTo: (next: Rect) => (current = next) }
}

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * Run a layout animation and report whether the element is still moving
 * after two frames of a ten second animation.
 */
async function isAnimating(
    from: Rect,
    to: Rect,
    transition: object = { duration: 10, ease: "linear" }
) {
    const { element, moveTo } = createElement(from)
    const animation = await animateLayout(() => moveTo(to), transition)
    await nextFrame()
    await nextFrame()
    const transform = element.style.transform
    animation.stop()
    element.remove()
    return transform !== "" && transform !== "none"
}

describe("animateLayout off-screen", () => {
    test("animates an element that moves within the viewport", async () => {
        expect(await isAnimating({ x: 0, y: 0 }, { x: 0, y: 300 })).toBe(true)
    })

    test("finishes an animation that starts and ends below the viewport", async () => {
        expect(await isAnimating({ x: 0, y: 2000 }, { x: 0, y: 3000 })).toBe(
            false
        )
    })

    test("finishes an animation that starts and ends right of the viewport", async () => {
        expect(await isAnimating({ x: 2000, y: 0 }, { x: 3000, y: 300 })).toBe(
            false
        )
    })

    test("animates an element that moves into the viewport", async () => {
        expect(await isAnimating({ x: 0, y: 3000 }, { x: 0, y: 300 })).toBe(
            true
        )
    })

    test("animates an element whose path crosses the viewport", async () => {
        expect(await isAnimating({ x: 0, y: -2000 }, { x: 0, y: 3000 })).toBe(
            true
        )
    })

    test("animates an element just outside the viewport", async () => {
        // Within the margin of a quarter of the viewport height.
        expect(await isAnimating({ x: 0, y: 800 }, { x: 0, y: 900 })).toBe(true)
    })

    test("animates a spring that can overshoot into the viewport", async () => {
        const from = { x: 0, y: 5000 }
        const to = { x: 0, y: 1100 }
        expect(await isAnimating(from, to)).toBe(false)
        expect(
            await isAnimating(from, to, {
                type: "spring",
                bounce: 0.5,
                duration: 10,
            })
        ).toBe(true)
        expect(
            await isAnimating(from, to, { duration: 10, ease: "backOut" })
        ).toBe(true)
    })

    test("animates an off-screen parent with an on-screen child", async () => {
        const parent = createElement({
            x: 0,
            y: 2000,
            width: 2000,
            height: 2000,
        })
        const child = createElement({ x: 0, y: 2000 }, parent.element)

        const animation = await animateLayout(
            () => {
                parent.moveTo({ x: 0, y: 2500, width: 2000, height: 2000 })
                child.moveTo({ x: 0, y: 100 })
            },
            { duration: 10, ease: "linear" }
        )
        await nextFrame()
        await nextFrame()

        expect(parent.element.style.transform).not.toBe("none")
        expect(parent.element.style.transform).not.toBe("")
        expect(child.element.style.transform).not.toBe("none")
        expect(child.element.style.transform).not.toBe("")

        animation.stop()
        parent.element.remove()
    })

    test("finishes an off-screen child of an animating parent", async () => {
        const parent = createElement({ x: 0, y: 0, width: 500, height: 4000 })
        const child = createElement({ x: 0, y: 2000 }, parent.element)

        const animation = await animateLayout(
            () => {
                parent.moveTo({ x: 0, y: 200, width: 500, height: 4000 })
                child.moveTo({ x: 0, y: 3000 })
            },
            { duration: 10, ease: "linear" }
        )
        await nextFrame()
        await nextFrame()

        expect(getNode(parent.element)!.currentAnimation).toBeDefined()
        expect(getNode(child.element)!.currentAnimation).toBeUndefined()

        animation.stop()
        parent.element.remove()
    })

    test("animates an off-screen shared layout element", async () => {
        const { element, moveTo } = createElement({ x: 0, y: 2000 })
        element.removeAttribute("data-layout")
        element.setAttribute("data-layout-id", "shared")

        const animation = await animateLayout(() => moveTo({ x: 0, y: 3000 }), {
            duration: 10,
            ease: "linear",
        })
        await nextFrame()
        await nextFrame()
        expect(element.style.transform).toContain("translate")

        animation.stop()
        element.remove()
    })
})
