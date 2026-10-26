import { motionValue } from "motion-dom"
import { useState } from "react"
import { act } from "react"
import { domMax, LazyMotion, m, motion, pinchFeatures } from "../.."
import { render } from "../../jest.setup"
import { nextFrame } from "./utils"

function pointer(
    target: EventTarget,
    type: string,
    pointerId: number,
    clientX: number,
    clientY = 0
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

/**
 * Spread two touches either side of the origin (where JSDOM puts every
 * element's centre) from 100px apart to 200px apart.
 */
async function spread(element: Element) {
    pointer(element, "pointerdown", 1, -50)
    pointer(element, "pointerdown", 2, 50)
    await nextFrame()
    pointer(window, "pointermove", 1, -100)
    pointer(window, "pointermove", 2, 100)
    await nextFrame()
    pointer(window, "pointerup", 1, -100)
    pointer(window, "pointerup", 2, 100)
    await nextFrame()
}

const features = { ...domMax, ...pinchFeatures }

describe("pinch prop", () => {
    test("m component scales with pinchFeatures loaded", async () => {
        const scale = motionValue(1)
        const { container } = render(
            <LazyMotion features={features}>
                <m.div pinch style={{ scale }} />
            </LazyMotion>
        )

        await act(() => spread(container.firstChild as Element))

        expect(scale.get()).toBeCloseTo(2)
        expect((container.firstChild as HTMLElement).style.touchAction).toBe(
            "none"
        )
    })

    test("motion component scales with pinchFeatures loaded", async () => {
        const scale = motionValue(1)
        const { container } = render(
            <LazyMotion features={features}>
                <motion.div pinch style={{ scale }} />
            </LazyMotion>
        )

        await act(() => spread(container.firstChild as Element))

        expect(scale.get()).toBeCloseTo(2)
    })

    test("passes options and callbacks", async () => {
        const scale = motionValue(1)
        const onEnd = jest.fn()
        const { container } = render(
            <LazyMotion features={features}>
                <m.div pinch={{ max: 1.5, onEnd }} style={{ scale }} />
            </LazyMotion>
        )

        await act(() => spread(container.firstChild as Element))

        expect(scale.get()).toBeCloseTo(1.5)
        expect(onEnd).toHaveBeenCalledTimes(1)
        expect(onEnd.mock.calls[0][1].scale).toBeCloseTo(2)
    })

    test("uses the latest options", async () => {
        const scale = motionValue(1)
        let setMax: (max: number) => void = () => {}
        const Component = () => {
            const [max, set] = useState(4)
            setMax = set
            return <m.div pinch={{ max }} style={{ scale }} />
        }
        const { container } = render(
            <LazyMotion features={features}>
                <Component />
            </LazyMotion>
        )

        act(() => setMax(1.25))
        await act(() => spread(container.firstChild as Element))

        expect(scale.get()).toBeCloseTo(1.25)
    })

    test("pinch={false} doesn't pinch", async () => {
        const scale = motionValue(1)
        let setPinch: (pinch: boolean) => void = () => {}
        const Component = () => {
            const [pinch, set] = useState(true)
            setPinch = set
            return <m.div pinch={pinch} style={{ scale }} />
        }
        const { container } = render(
            <LazyMotion features={features}>
                <Component />
            </LazyMotion>
        )

        act(() => setPinch(false))
        await act(() => spread(container.firstChild as Element))

        expect(scale.get()).toBe(1)
    })

    test("pinch={false} gives the page its touch gestures back", () => {
        let setPinch: (pinch: boolean) => void = () => {}
        const Component = () => {
            const [pinch, set] = useState(true)
            setPinch = set
            return <m.div pinch={pinch} />
        }
        const { container } = render(
            <LazyMotion features={features}>
                <Component />
            </LazyMotion>
        )
        const element = container.firstChild as HTMLElement

        expect(element.style.touchAction).toBe("none")
        act(() => setPinch(false))
        // JSDOM doesn't know touch-action, so the restored value is unset.
        expect(element.style.touchAction).not.toBe("none")
        act(() => setPinch(true))
        expect(element.style.touchAction).toBe("none")
    })

    test("keeps touch gestures off when drag's axis changes", () => {
        let setAxis: (axis: "x" | "y") => void = () => {}
        const Component = () => {
            const [axis, set] = useState<"x" | "y">("x")
            setAxis = set
            return <m.div pinch drag={axis} />
        }
        const { container } = render(
            <LazyMotion features={features}>
                <Component />
            </LazyMotion>
        )
        const element = container.firstChild as HTMLElement

        expect(element.style.touchAction).toBe("none")
        act(() => setAxis("y"))
        expect(element.style.touchAction).toBe("none")
    })

    test("pinch={false} mid-gesture ends it", async () => {
        const scale = motionValue(1)
        const onEnd = jest.fn()
        let setPinch: (pinch: boolean) => void = () => {}
        const Component = () => {
            const [pinch, set] = useState(true)
            setPinch = set
            return (
                <m.div pinch={pinch && { max: 1.2, onEnd }} style={{ scale }} />
            )
        }
        const { container } = render(
            <LazyMotion features={features}>
                <Component />
            </LazyMotion>
        )
        const element = container.firstChild as Element

        pointer(element, "pointerdown", 1, -50)
        pointer(element, "pointerdown", 2, 50)
        await act(() => nextFrame())
        act(() => setPinch(false))
        pointer(window, "pointermove", 1, -100)
        pointer(window, "pointermove", 2, 100)
        await act(() => nextFrame())

        expect(scale.get()).toBe(1)
        expect(onEnd).toHaveBeenCalledTimes(1)

        pointer(window, "pointerup", 1, -100)
        pointer(window, "pointerup", 2, 100)
    })

    test("removes listeners on unmount", async () => {
        const onStart = jest.fn()
        const { container, rerender } = render(
            <LazyMotion features={features}>
                <m.div pinch={{ onStart }} />
            </LazyMotion>
        )
        const element = container.firstChild as Element

        rerender(<LazyMotion features={features}>{null}</LazyMotion>)
        await act(() => spread(element))

        expect(onStart).not.toHaveBeenCalled()
    })

    test("isn't forwarded to the DOM", () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {})
        const { container } = render(
            <>
                <motion.div pinch />
                <motion.div pinch={{ max: 2 }} />
            </>
        )
        const [a, b] = Array.from(container.children)
        expect(a.hasAttribute("pinch")).toBe(false)
        expect(b.hasAttribute("pinch")).toBe(false)
        expect(error).not.toHaveBeenCalled()
        error.mockRestore()
    })
})
