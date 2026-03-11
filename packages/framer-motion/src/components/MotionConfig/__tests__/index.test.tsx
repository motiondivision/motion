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

describe("skipAnimations", () => {
    test("skipAnimations makes all animations complete instantly", async () => {
        const result = await new Promise<[number, number]>(async (resolve) => {
            const x = motionValue(0)
            const opacity = motionValue(0)
            const Component = () => {
                return (
                    <MotionConfig skipAnimations>
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

        // Both transform and non-transform values should complete instantly
        expect(result[0]).toEqual(100)
        expect(result[1]).toEqual(1)
    })

    test("skipAnimations=false does not skip animations", async () => {
        const result = await new Promise<[number, number]>(async (resolve) => {
            const x = motionValue(0)
            const opacity = motionValue(0)
            const Component = () => {
                return (
                    <MotionConfig skipAnimations={false}>
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

        // Values should still be animating (not yet at final value)
        expect(result[0]).not.toEqual(100)
        expect(result[1]).not.toEqual(1)
    })

    test("skipAnimations is scoped to component tree", async () => {
        const result = await new Promise<[number, number, number, number]>(
            async (resolve) => {
                const x1 = motionValue(0)
                const opacity1 = motionValue(0)
                const x2 = motionValue(0)
                const opacity2 = motionValue(0)

                const Component = () => {
                    return (
                        <>
                            <MotionConfig skipAnimations>
                                <motion.div
                                    animate={{ opacity: 1, x: 100 }}
                                    transition={{ duration: 2 }}
                                    style={{ x: x1, opacity: opacity1 }}
                                />
                            </MotionConfig>
                            <motion.div
                                animate={{ opacity: 1, x: 100 }}
                                transition={{ duration: 2 }}
                                style={{ x: x2, opacity: opacity2 }}
                            />
                        </>
                    )
                }

                const { rerender } = render(<Component />)
                rerender(<Component />)

                await nextFrame()

                resolve([x1.get(), opacity1.get(), x2.get(), opacity2.get()])
            }
        )

        // Inside MotionConfig with skipAnimations - should be instant
        expect(result[0]).toEqual(100)
        expect(result[1]).toEqual(1)
        // Outside MotionConfig - should still be animating
        expect(result[2]).not.toEqual(100)
        expect(result[3]).not.toEqual(1)
    })
})
