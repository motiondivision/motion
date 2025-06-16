import { motionValue, MotionValue } from "motion-dom"
import { useEffect } from "react"
import { motion } from "../../"
import { syncDriver } from "../../animation/animators/__tests__/utils"
import { render } from "../../jest.setup"
import { useMotionValue } from "../use-motion-value"
import { useSpring } from "../use-spring"

describe("useSpring types", () => {
    test("can create a motion value from a number", async () => {
        const Component = () => {
            const x = useSpring(0)
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a string with a unit", async () => {
        const Component = () => {
            const x = useSpring("0%")
            expect(x.get()).toBe("0%")
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a number motion value", async () => {
        const Component = () => {
            const source = motionValue(0)
            const x = useSpring(source)
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a string motion value with a unit", async () => {
        const Component = () => {
            const source = motionValue("0%")
            const x = useSpring(source)
            expect(x.get()).toBe("0%")
            return null
        }
        render(<Component />)
    })
})

const runSpringTests = (unit?: string | undefined) => {
    const createValue = (num: number) => {
        if (unit) {
            return `${num}${unit}` as unknown as number
        }
        return num as number
    }

    const parseTestValue = (val: string | number): number =>
        typeof val === "string" ? parseFloat(val) : val

    const formatOutput = (num: number) => {
        if (unit) {
            return `${Math.round(num)}${unit}`
        }
        return Math.round(num)
    }

    describe(`useSpring ${unit ? `with ${unit}` : "with numbers"}`, () => {
        test("can create a motion value from a number", async () => {
            const promise = new Promise((resolve) => {
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const spring = useSpring(x)

                    useEffect(() => {
                        spring.on("change", (v) => resolve(v))
                        x.set(createValue(100))
                    })

                    return null
                }

                const { rerender } = render(<Component />)
                rerender(<Component />)
            })

            const resolved = await promise

            expect(resolved).not.toBe(createValue(0))
            expect(resolved).not.toBe(createValue(100))
        })

        test("can create a MotionValue that responds to changes from another MotionValue", async () => {
            const promise = new Promise((resolve) => {
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useSpring(x)

                    useEffect(() => {
                        y.on("change", (v) => resolve(v))
                        x.set(createValue(100))
                    })

                    return null
                }

                const { rerender } = render(<Component />)
                rerender(<Component />)
            })

            const resolved = await promise

            expect(resolved).not.toBe(createValue(0))
            expect(resolved).not.toBe(createValue(100))
        })

        test("creates a spring that animates to the subscribed motion value", async () => {
            const promise = new Promise<Array<string | number>>((resolve) => {
                const output: Array<string | number> = []
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useSpring(x, {
                        driver: syncDriver(10),
                    } as any)

                    useEffect(() => {
                        return y.on("change", (v) => {
                            if (output.length >= 10) {
                                resolve(output)
                            } else {
                                output.push(formatOutput(parseTestValue(v)))
                            }
                        })
                    })

                    useEffect(() => {
                        x.set(createValue(100))
                    }, [])

                    return null
                }

                const { rerender } = render(<Component />)
                rerender(<Component />)
            })

            const resolved = await promise

            const testNear = (
                value: string | number,
                expected: number,
                deviation = 2
            ) => {
                const numValue = parseTestValue(value)
                expect(
                    numValue >= expected - deviation &&
                        numValue <= expected + deviation
                ).toBe(true)
            }

            testNear(resolved[0], 0)
            testNear(resolved[4], 10)
            testNear(resolved[8], 30)
        })

        test("will not animate if immediate=true", async () => {
            const promise = new Promise((resolve) => {
                const output: Array<string | number> = []
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useSpring(x, {
                        driver: syncDriver(10),
                    } as any)

                    useEffect(() => {
                        return y.on("change", (v) => {
                            if (output.length >= 10) {
                            } else {
                                output.push(formatOutput(parseTestValue(v)))
                            }
                        })
                    })

                    useEffect(() => {
                        y.jump(createValue(100))

                        setTimeout(() => {
                            resolve(output)
                        }, 100)
                    }, [])

                    return null
                }

                const { rerender } = render(<Component />)
                rerender(<Component />)
            })

            const resolved = await promise

            expect(resolved).toEqual([createValue(100)])
        })

        test("unsubscribes when attached to a new value", () => {
            const a = motionValue(createValue(0))
            const b = motionValue(createValue(0))
            let y: MotionValue<number>
            const Component = ({ target }: { target: MotionValue<number> }) => {
                y = useSpring(target)
                return <motion.div style={{ y }} />
            }

            const { rerender } = render(<Component target={a} />)
            rerender(<Component target={b} />)
            rerender(<Component target={a} />)
            rerender(<Component target={b} />)
            rerender(<Component target={a} />)
            rerender(<Component target={a} />)

            // Cast to any here as `.events` is private API
            expect((a as any).events.change.getSize()).toBe(1)
        })
    })
}

// Run tests for both number values and percentage values
runSpringTests()
runSpringTests("%")
