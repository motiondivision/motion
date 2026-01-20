import { motionValue, MotionValue } from "motion-dom"
import { useEffect } from "react"
import { motion, useMotionValueEvent } from "../../"
import { syncDriver } from "../../animation/animators/__tests__/utils"
import { render } from "../../jest.setup"
import { useMotionValue } from "../use-motion-value"
import { useFollowValue } from "../use-follow-value"

describe("useFollowValue types", () => {
    test("can create a motion value from a number", async () => {
        const Component = () => {
            const x = useFollowValue(0)
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a string with a unit", async () => {
        const Component = () => {
            const x = useFollowValue("0%")
            expect(x.get()).toBe("0%")
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a number motion value", async () => {
        const Component = () => {
            const source = motionValue(0)
            const x = useFollowValue(source)
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("can create a motion value from a string motion value with a unit", async () => {
        const Component = () => {
            const source = motionValue("0%")
            const x = useFollowValue(source)
            expect(x.get()).toBe("0%")
            return null
        }
        render(<Component />)
    })
})

const runAnimatedValueTests = (unit?: string | undefined) => {
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

    describe(`useFollowValue ${unit ? `with ${unit}` : "with numbers"}`, () => {
        test("can create a motion value from a number (default spring)", async () => {
            const promise = new Promise((resolve) => {
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const animated = useFollowValue(x)

                    useEffect(() => {
                        animated.on("change", (v) => resolve(v))
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
                    const y = useFollowValue(x)

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

        test("creates a spring animation when type is spring", async () => {
            const promise = new Promise<Array<string | number>>((resolve) => {
                const output: Array<string | number> = []
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useFollowValue(x, {
                        type: "spring",
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

        test("creates a tween animation when type is tween", async () => {
            const promise = new Promise<Array<string | number>>((resolve) => {
                const output: Array<string | number> = []
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useFollowValue(x, {
                        type: "tween",
                        duration: 0.1,
                        ease: "linear",
                        driver: syncDriver(10),
                    } as any)

                    useEffect(() => {
                        return y.on("change", (v) => {
                            if (output.length >= 11) {
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

            // With linear easing and 100ms duration, values should progress linearly
            // Each frame is 10ms, so we expect 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
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
            testNear(resolved[5], 50)
            testNear(resolved[10], 100)
        })

        test("will not animate if immediate=true (jump)", async () => {
            const promise = new Promise((resolve) => {
                const output: Array<string | number> = []
                const Component = () => {
                    const x = useMotionValue(createValue(0))
                    const y = useFollowValue(x, {
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
                y = useFollowValue(target)
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
runAnimatedValueTests()
runAnimatedValueTests("%")

describe("useFollowValue animation events", () => {
    test("triggers animationStart event when animation begins", async () => {
        const promise = new Promise<boolean>((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                const animatedX = useFollowValue(x, {
                    type: "spring",
                    stiffness: 100,
                    damping: 10,
                })

                useMotionValueEvent(animatedX, "animationStart", () => {
                    resolve(true)
                })

                useEffect(() => {
                    x.set(100)
                }, [x])

                return null
            }

            render(<Component />)
        })

        await expect(promise).resolves.toBe(true)
    })

    test("triggers animationComplete event when animation finishes", async () => {
        const promise = new Promise<boolean>((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                const animatedX = useFollowValue(x, {
                    type: "spring",
                    stiffness: 1000,
                    damping: 50,
                })

                useMotionValueEvent(animatedX, "animationComplete", () => {
                    resolve(true)
                })

                useEffect(() => {
                    x.set(100)
                }, [x])

                return null
            }

            render(<Component />)
        })

        await expect(promise).resolves.toBe(true)
    })
})

describe("useFollowValue with different transition types", () => {
    test("accepts spring configuration", async () => {
        const Component = () => {
            const x = useFollowValue(0, {
                type: "spring",
                stiffness: 300,
                damping: 20,
                mass: 1,
            })
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("accepts tween configuration", async () => {
        const Component = () => {
            const x = useFollowValue(0, {
                type: "tween",
                duration: 0.5,
                ease: "easeInOut",
            })
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("accepts delay configuration", async () => {
        const Component = () => {
            const x = useFollowValue(0, {
                type: "spring",
                delay: 0.5,
            })
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })

    test("accepts repeat configuration", async () => {
        const Component = () => {
            const x = useFollowValue(0, {
                type: "tween",
                duration: 0.2,
                repeat: 2,
                repeatType: "reverse",
            })
            expect(x.get()).toBe(0)
            return null
        }
        render(<Component />)
    })
})
