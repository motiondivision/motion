import { motionValue, optimizedAppearDataAttribute } from "motion-dom"
import { motion } from "../../../"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"

/**
 * Handing off from an optimised appear animation when initial sets
 * transition.out (#1725). The appear script is a separate bundle that can be
 * older or newer than this runtime, so the runtime only continues with
 * initial's out transition when the script says the appear animation was
 * generated from it. Otherwise it continues with the entered state's
 * transition, like every appear script before transition.out.
 */
const frames = async (n = 3) => {
    for (let i = 0; i < n; i++) await nextFrame()
}

const Component = ({
    opacity,
}: {
    opacity: ReturnType<typeof motionValue>
}) => (
    <motion.div
        {...{ [optimizedAppearDataAttribute]: "a" }}
        initial={{ opacity: 0, transition: { out: { delay: 10 } } }}
        animate={{ opacity: 1 }}
        transition={{ type: false }}
        style={{ opacity }}
    />
)

describe("optimised appear handoff with initial's transition.out", () => {
    let handoff: jest.Mock

    beforeEach(() => {
        handoff = jest.fn(() => performance.now())
        window.MotionHandoffAnimation = handoff
    })

    afterEach(() => {
        delete window.MotionHandoffAnimation
        delete window.MotionHandoffUsesOut
    })

    test("old appear script (no MotionHandoffUsesOut): continues with animate's transition", async () => {
        const opacity = motionValue(0)
        const { rerender } = render(<Component opacity={opacity} />)
        rerender(<Component opacity={opacity} />)
        await frames()

        expect(handoff).toHaveBeenCalledWith("a", "opacity", expect.anything())
        expect(opacity.get()).toBe(1)
    })

    test("new appear script generated from out: continues with initial's out transition", async () => {
        const usesOut = jest.fn(() => true)
        window.MotionHandoffUsesOut = usesOut

        const opacity = motionValue(0)
        const { rerender } = render(<Component opacity={opacity} />)
        rerender(<Component opacity={opacity} />)
        await frames()

        expect(usesOut).toHaveBeenCalledWith("a", "opacity")
        expect(opacity.get()).toBe(0)
    })

    test("new appear script not generated from out: continues with animate's transition", async () => {
        window.MotionHandoffUsesOut = () => false

        const opacity = motionValue(0)
        const { rerender } = render(<Component opacity={opacity} />)
        rerender(<Component opacity={opacity} />)
        await frames()

        expect(opacity.get()).toBe(1)
    })

    test("no appear animation for the value: initial's out transition applies", async () => {
        handoff.mockImplementation(() => null)

        const opacity = motionValue(0)
        const { rerender } = render(<Component opacity={opacity} />)
        rerender(<Component opacity={opacity} />)
        await frames()

        expect(opacity.get()).toBe(0)
    })
})
