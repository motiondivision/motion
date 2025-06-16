import {
    frame,
    motion,
    MotionGlobalConfig,
    useMotionValue,
    useWillChange,
} from "../../.."
import { nextFrame } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { WillChangeMotionValue } from "../WillChangeMotionValue"

describe("WillChangeMotionValue", () => {
    test("Can manage transform alongside independent transforms", async () => {
        const willChange = new WillChangeMotionValue("auto")
        willChange.add("transform")
        expect(willChange.get()).toBe("transform")

        const willChange2 = new WillChangeMotionValue("auto")
        willChange2.add("x")
        willChange2.add("y")
        expect(willChange2.get()).toBe("transform")
    })
})

describe("willChange", () => {
    test("Renders values defined in animate on initial render", async () => {
        const Component = () => {
            const opacity = useMotionValue(0)
            const willChange = useWillChange()
            return (
                <motion.div
                    animate={{ x: 100, backgroundColor: "#000" }}
                    style={{ opacity, willChange }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Doesn't render CSS variables or non-hardware accelerated values", async () => {
        const Component = () => {
            const willChange = useWillChange()
            return (
                <motion.div
                    animate={
                        {
                            filter: "blur(10px)",
                            background: "#000",
                            "--test": "#000",
                        } as any
                    }
                    style={{ willChange }}
                />
            )
        }

        const { container } = render(<Component />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Externally-provided motion values are not added to will-change", async () => {
        const Component = () => {
            const willChange = useWillChange()
            const opacity = useMotionValue(0)
            const height = useMotionValue(100)
            return <motion.div style={{ opacity, height, willChange }} />
        }

        const { container } = render(<Component />)

        expect(container.firstChild).not.toHaveStyle("will-change: opacity;")
        expect(container.firstChild).not.toHaveStyle(
            "will-change: height, opacity;"
        )
        expect(container.firstChild).not.toHaveStyle(
            "will-change: opacity, height;"
        )
    })

    test("Don't remove values when they finish animating", async () => {
        return new Promise<void>(async (resolve) => {
            const Component = () => {
                const willChange = useWillChange()
                return (
                    <motion.div
                        transition={{ duration: 0.1 }}
                        animate={{ x: 100 }}
                        style={{ willChange }}
                        onAnimationComplete={() => {
                            frame.postRender(() => {
                                expect(container.firstChild).toHaveStyle(
                                    "will-change: transform;"
                                )
                                resolve()
                            })
                        }}
                    />
                )
            }

            const { container } = render(<Component />)

            await nextFrame()

            expect(container.firstChild).toHaveStyle("will-change: transform;")
        })
    })

    test("Add values when they start animating", async () => {
        const Component = ({ animate }: any) => {
            const willChange = useWillChange()
            return (
                <motion.div
                    initial={false}
                    animate={animate}
                    transition={{ duration: 0.1 }}
                    style={{ willChange }}
                />
            )
        }
        const { container, rerender } = render(<Component animate={{}} />)
        await nextFrame()

        expect(container.firstChild).not.toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 100 }} />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Doesn't remove values when animation interrupted", async () => {
        const Component = ({ animate }: any) => {
            const willChange = useWillChange()
            return (
                <motion.div
                    initial={{ x: 0 }}
                    animate={animate}
                    transition={{ duration: 0.1 }}
                    style={{ willChange }}
                />
            )
        }
        const { container, rerender } = render(<Component animate={{}} />)
        await nextFrame()

        expect(container.firstChild).not.toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 100 }} />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 200 }} />)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })
})

describe("willChange injection", () => {
    beforeAll(() => {
        MotionGlobalConfig.WillChange = WillChangeMotionValue
    })

    afterAll(() => {
        MotionGlobalConfig.WillChange = undefined
    })

    test("Renders values defined in animate on initial render", async () => {
        const Component = () => {
            const opacity = useMotionValue(0)
            return (
                <motion.div
                    animate={{ x: 100, backgroundColor: "#000" }}
                    style={{ opacity }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Doesn't render CSS variables or non-hardware accelerated values", async () => {
        const Component = () => {
            return (
                <motion.div
                    animate={
                        {
                            filter: "blur(10px)",
                            background: "#000",
                            "--test": "#000",
                        } as any
                    }
                />
            )
        }

        const { container } = render(<Component />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Externally-provided motion values are not added to will-change", async () => {
        const Component = () => {
            const opacity = useMotionValue(0)
            const height = useMotionValue(100)
            return <motion.div style={{ opacity, height }} />
        }

        const { container } = render(<Component />)

        expect(container.firstChild).not.toHaveStyle("will-change: opacity;")
        expect(container.firstChild).not.toHaveStyle(
            "will-change: height, opacity;"
        )
        expect(container.firstChild).not.toHaveStyle(
            "will-change: opacity, height;"
        )
    })

    test("Don't remove values when they finish animating", async () => {
        return new Promise<void>(async (resolve) => {
            const Component = () => {
                return (
                    <motion.div
                        transition={{ duration: 0.1 }}
                        animate={{ x: 100 }}
                        onAnimationComplete={() => {
                            frame.postRender(() => {
                                expect(container.firstChild).toHaveStyle(
                                    "will-change: transform;"
                                )
                                resolve()
                            })
                        }}
                    />
                )
            }

            const { container } = render(<Component />)

            await nextFrame()

            expect(container.firstChild).toHaveStyle("will-change: transform;")
        })
    })

    test("Add values when they start animating", async () => {
        const Component = ({ animate }: any) => {
            return (
                <motion.div
                    initial={false}
                    animate={animate}
                    transition={{ duration: 0.1 }}
                />
            )
        }
        const { container, rerender } = render(<Component animate={{}} />)
        await nextFrame()

        expect(container.firstChild).not.toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 100 }} />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })

    test("Doesn't remove values when animation interrupted", async () => {
        const Component = ({ animate }: any) => {
            return (
                <motion.div
                    initial={{ x: 0 }}
                    animate={animate}
                    transition={{ duration: 0.1 }}
                />
            )
        }
        const { container, rerender } = render(<Component animate={{}} />)
        await nextFrame()

        expect(container.firstChild).not.toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 100 }} />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("will-change: transform;")
        rerender(<Component animate={{ x: 200 }} />)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("will-change: transform;")
    })
})
