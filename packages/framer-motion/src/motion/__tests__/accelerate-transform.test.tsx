import { bindAccelerateTransform, frame, motionValue } from "motion-dom"
import { motion } from "../../"
import { render } from "../../jest.setup"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * A transform with `accelerate` (as made by useScroll and useTransform)
 * joins the element's transform animation, which its factory links to a
 * timeline. Where that can't run on the compositor, as in JSDOM, which
 * has no WAAPI, the value is written from JS as before.
 */
describe("accelerated transforms", () => {
    const setup = () => {
        const cleanup = jest.fn()
        const factory = jest.fn(() => cleanup)
        const y = motionValue(0)
        y.accelerate = {
            bind: () => () => {},
            bindTransform: bindAccelerateTransform,
            factory,
            times: [0, 0, 1, 1],
            keyframes: [0, 0, 200, 200],
            ease: (v: number) => v,
            duration: 1,
        }
        const result = render(<motion.div style={{ y }} />)
        return {
            ...result,
            y,
            cleanup,
            factory,
            element: result.container.firstChild as HTMLElement,
        }
    }

    test("links an animation of the transform to the timeline", () => {
        const { factory } = setup()
        expect(factory).toHaveBeenCalledTimes(1)
        const [animation] = factory.mock.calls[0] as any
        expect(typeof animation.attachTimeline).toBe("function")
    })

    test("is written from JS when it can't run on the compositor", async () => {
        const { y, element, cleanup } = setup()
        await nextFrame()
        await nextFrame()

        expect(cleanup).toHaveBeenCalled()

        y.set(50)
        await nextFrame()
        expect(element.style.transform).toBe("translateY(50px)")
    })

    test("stops the animation on unmount", () => {
        const { unmount, cleanup } = setup()
        unmount()
        expect(cleanup).toHaveBeenCalled()
    })
})
