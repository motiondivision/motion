import { motionValue } from "motion-dom"
import { MotionConfig } from "../"
import { nextFrame } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { motion } from "../../../render/components/motion"

describe("custom properties", () => {
    test("renders", () => {
        const Component = () => {
            return (
                <MotionConfig isValidProp={(key) => key !== "data-foo"}>
                    <motion.div data-foo="bar" data-bar="foo" />
                </MotionConfig>
            )
        }

        const { container } = render(<Component />)

        expect(container.firstChild).not.toHaveAttribute("data-foo")
        expect(container.firstChild).toHaveAttribute("data-bar")
    })
})

describe("reducedMotion", () => {
    test("reducedMotion warning fires in development mode", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {})

        await new Promise<void>((resolve) => {
            const Component = () => {
                return (
                    <MotionConfig reducedMotion="always">
                        <motion.div
                            animate={{ opacity: 0.5 }}
                            transition={{ type: false }}
                            onAnimationComplete={() => resolve()}
                        />
                    </MotionConfig>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(warn).toHaveBeenCalled()

        warn.mockReset()
    })

    test("reducedMotion makes transforms animate instantly", async () => {
        const result = await new Promise<[number, number]>(async (resolve) => {
            const x = motionValue(0)
            const opacity = motionValue(0)
            const Component = () => {
                return (
                    <MotionConfig reducedMotion="always">
                        <motion.div
                            animate={{ opacity: 1, x: 100 }}
                            transition={{ duration: 2 }}
                            style={{ x, opacity }}
                        />
                    </MotionConfig>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)

            await nextFrame()

            resolve([x.get(), opacity.get()])
        })

        expect(result[0]).toEqual(100)
        expect(result[1]).not.toEqual(1)
    })
})
