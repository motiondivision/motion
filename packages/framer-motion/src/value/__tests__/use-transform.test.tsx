import { motionValue, MotionValue } from "motion-dom"
import { useEffect } from "react"
import { cancelFrame, frame, motion } from "../../"
import { nextFrame, nextMicrotask } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { useMotionValue } from "../use-motion-value"
import { useTransform } from "../use-transform"

describe("as function", () => {
    test("sets initial value", async () => {
        const Component = () => {
            const x = useMotionValue(100)
            const y = useTransform(x, (v) => -v)
            return <motion.div style={{ x, y }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(100px) translateY(-100px)"
        )
    })
})

describe("as function with multiple values", () => {
    test("sets initial value", async () => {
        const Component = () => {
            const x = useMotionValue(4)
            const y = useMotionValue("5px")
            const z = useTransform(
                [x, y],
                ([latestX, latestY]: [number, string]) =>
                    latestX * parseFloat(latestY)
            )
            return <motion.div style={{ x, y, z }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(4px) translateY(5px) translateZ(20px)"
        )
    })
})

describe("as function with no passed MotionValues", () => {
    test("sets initial value", async () => {
        const x = motionValue(4)
        const Component = () => {
            const y = useMotionValue("5px")
            const z = useTransform(() => x.get() * parseFloat(y.get()))
            return <motion.div style={{ x, y, z }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(4px) translateY(5px) translateZ(20px)"
        )

        x.set(5)

        await new Promise<void>((resolve) => {
            frame.postRender(() => {
                expect(container.firstChild).toHaveStyle(
                    "transform: translateX(5px) translateY(5px) translateZ(25px)"
                )
                resolve()
            })
        })
    })
})

describe("as input/output range", () => {
    test("sets initial value", async () => {
        const Component = () => {
            const x = useMotionValue(100)
            const opacity = useTransform(x, [0, 200], [0, 1])
            return <motion.div style={{ x, opacity }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("opacity: 0.5")
    })

    test("responds to manual setting from parent value", async () => {
        const Component = () => {
            const x = useMotionValue(100)
            const opacity = useTransform(x, [0, 200], [0, 1])

            useEffect(() => {
                x.set(20)
            }, [])

            return <motion.div style={{ x, opacity }} />
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(container.firstChild).toHaveStyle("opacity: 0.1")
    })

    test("updates when values change", async () => {
        const x = motionValue(20)
        let o = motionValue(0)
        const Component = ({ a = 0, b = 100, c = 0, d = 1 }: any) => {
            const opacity = useTransform(x, [a, b], [c, d])
            o = opacity
            return <motion.div style={{ x, opacity }} />
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        await nextMicrotask()
        expect(container.firstChild).toHaveStyle("opacity: 0.2")
        rerender(<Component b={50} />)
        rerender(<Component b={50} />)
        await nextMicrotask()
        expect(container.firstChild).toHaveStyle("opacity: 0.4")
        rerender(<Component b={50} d={0.5} />)
        rerender(<Component b={50} d={0.5} />)
        await nextMicrotask()
        expect(container.firstChild).toHaveStyle("opacity: 0.2")
        x.set(40)

        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(o.get()).toBe(0.4)
                resolve()
            }, 20)
        })
    })
})

test("is correctly typed", async () => {
    const Component = () => {
        const x = useMotionValue(0)
        const y = useTransform(x, [0, 1], ["0px", "1px"])
        const z = useTransform(x, (v) => v * 2)
        return <motion.div style={{ x, y, z }} />
    }

    render(<Component />)
})

test("frame scheduling", async () => {
    return new Promise<void>((resolve) => {
        const Component = () => {
            const x = useMotionValue(0)
            const y = useMotionValue(0)
            const z = useTransform(() => x.get() + y.get())

            useEffect(() => {
                const setX = () => {
                    x.set(1)
                    frame.update(setY)
                }
                const setY = () => y.set(2)

                const checkFrame = () => {
                    expect(container.firstChild as Element).toHaveStyle(
                        "transform: translateX(1px) translateY(2px) translateZ(3px)"
                    )

                    resolve()
                }

                frame.read(setX)
                frame.postRender(checkFrame)

                return () => {
                    cancelFrame(setY)
                    cancelFrame(checkFrame)
                }
            }, [])

            return <motion.div style={{ x, y, z }} />
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)
    })
})

test("can be re-pointed to another `MotionValue`", async () => {
    const a = motionValue(1)
    const b = motionValue(2)
    let x = motionValue(0)

    const Component = ({ target }: { target: MotionValue<number> }) => {
        x = useTransform(target, [0, 1], [0, 2], { clamp: false })
        return <motion.div style={{ x }} />
    }

    const { container, rerender } = render(<Component target={a} />)
    rerender(<Component target={b} />)

    await nextMicrotask()
    expect(container.firstChild as Element).toHaveStyle(
        "transform: translateX(4px)"
    )

    rerender(<Component target={a} />)
    await nextMicrotask()
    expect(container.firstChild as Element).toHaveStyle(
        "transform: translateX(2px)"
    )
})
