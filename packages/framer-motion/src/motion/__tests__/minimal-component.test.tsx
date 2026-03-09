import { motionValue } from "motion-dom"
import { createMinimalMotionComponent } from "../../render/components/m/create"
import { render } from "../../jest.setup"

/**
 * Issue #3194: motion/react-m components should animate with the animate prop
 * without requiring LazyMotion.
 */
describe("Minimal motion component (motion/react-m)", () => {
    test("animates with the animate prop", async () => {
        const MotionDiv = createMinimalMotionComponent("div")

        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <MotionDiv
                    animate={{ x: 20 }}
                    transition={{ duration: 0.01 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
            setTimeout(() => resolve(x.get()), 100)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("applies animate values with initial prop", async () => {
        const MotionDiv = createMinimalMotionComponent("div")

        const promise = new Promise((resolve) => {
            const opacity = motionValue(0)
            const onComplete = () => resolve(opacity.get())

            const Component = () => (
                <MotionDiv
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.01 }}
                    style={{ opacity }}
                    onAnimationComplete={onComplete}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
            setTimeout(() => resolve(opacity.get()), 100)
        })

        return expect(promise).resolves.toBe(1)
    })
})
