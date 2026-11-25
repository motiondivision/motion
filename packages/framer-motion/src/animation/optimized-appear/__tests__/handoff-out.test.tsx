import { motionValue, optimizedAppearDataAttribute } from "motion-dom"
import { motion } from "../../../"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"

/**
 * Handing off from an optimised appear animation (#1725). The generator
 * builds the appear animation from initial's transition.out when it's set,
 * otherwise from animate's transition. On handoff the runtime follows the
 * same rule as its mount animation, so both sides read the same props and
 * the handoff protocol is unchanged.
 */
const frames = async (n = 3) => {
    for (let i = 0; i < n; i++) await nextFrame()
}

describe("optimised appear handoff with transition.out", () => {
    let handoff: jest.Mock

    beforeEach(() => {
        handoff = jest.fn(() => performance.now())
        window.MotionHandoffAnimation = handoff
    })

    afterEach(() => {
        delete window.MotionHandoffAnimation
    })

    test("continues with initial's out transition when initial sets one", async () => {
        const opacity = motionValue(0)
        const Component = () => (
            <motion.div
                {...{ [optimizedAppearDataAttribute]: "a" }}
                initial={{ opacity: 0, transition: { out: { delay: 10 } } }}
                animate={{ opacity: 1 }}
                transition={{ type: false }}
                style={{ opacity }}
            />
        )

        const { rerender } = render(<Component />)
        rerender(<Component />)
        await frames()

        // The handoff call itself is unchanged
        expect(handoff).toHaveBeenCalledWith("a", "opacity", expect.anything())
        expect(handoff.mock.calls[0]).toHaveLength(3)
        expect(opacity.get()).toBe(0)
    })

    test("continues with animate's transition when initial has no out", async () => {
        const opacity = motionValue(0)
        const Component = () => (
            <motion.div
                {...{ [optimizedAppearDataAttribute]: "a" }}
                initial={{ opacity: 0, transition: { delay: 10 } }}
                animate={{ opacity: 1 }}
                transition={{ type: false }}
                style={{ opacity }}
            />
        )

        const { rerender } = render(<Component />)
        rerender(<Component />)
        await frames()

        expect(handoff).toHaveBeenCalled()
        expect(opacity.get()).toBe(1)
    })
})
