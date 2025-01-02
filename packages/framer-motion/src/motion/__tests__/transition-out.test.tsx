import {
    render,
    pointerDown,
    pointerEnter,
    pointerLeave,
    pointerUp,
} from "../../../jest.setup"
import { motion, motionValue } from "../../"
import { nextFrame } from "../../gestures/__tests__/utils"

describe("transition.out", () => {
    it("uses whileHover transition when exiting hover state", async () => {
        const opacity = motionValue(0)

        const { container } = render(
            <motion.div
                animate={{ opacity: 0, transition: { duration: 1 } }}
                transition={{ duration: 1 }}
                whileHover={{
                    opacity: 1,
                    transition: {
                        type: false,
                        out: true,
                    },
                }}
                style={{ opacity }}
            />
        )

        // Enter hover
        pointerEnter(container.firstChild as Element)

        await nextFrame()
        await nextFrame()

        expect(opacity.get()).toBe(1)

        // Exit hover - should use whileHover transition with type: false
        pointerLeave(container.firstChild as Element)

        // Wait for animation to complete
        await nextFrame()
        await nextFrame()

        expect(opacity.get()).toBe(0)
    })

    it("uses whileTap out transition when tap ends before hover", async () => {
        const scale = motionValue(1)

        const { container } = render(
            <motion.div
                animate={{ scale: 1, transition: { duration: 1 } }}
                whileHover={{
                    scale: 1.1,
                    transition: { duration: 1 },
                }}
                whileTap={{
                    scale: 0.9,
                    transition: {
                        type: false,
                        out: true,
                    },
                }}
                style={{ scale }}
            />
        )

        // Enter hover
        pointerEnter(container.firstChild as Element)

        await nextFrame()

        // Start tap
        pointerDown(container.firstChild as Element)

        await nextFrame()
        await nextFrame()

        expect(scale.get()).toBe(0.9)

        // End tap before ending hover
        pointerUp(container.firstChild as Element)

        await nextFrame()

        // Wait a frame to ensure animation has completed
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Should use whileTap out transition which is instant
        expect(scale.get()).toBe(1.1)

        // Leave hover
        pointerLeave(container.firstChild as Element)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(scale.get()).not.toBe(1)
    })
})
