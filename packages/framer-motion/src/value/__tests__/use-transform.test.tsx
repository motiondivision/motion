import { motionValue, MotionValue } from "motion-dom"
import { useEffect, useInsertionEffect, useLayoutEffect } from "react"
import { cancelFrame, frame, motion } from "../../"
import { nextFrame, nextMicrotask } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { useMotionValue } from "../use-motion-value"
import { useMotionTemplate } from "../use-motion-template"
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
        /**
         * The motion component's props don't change, so it doesn't
         * re-render. The transformed value is written in the next frame,
         * before the browser paints.
         */
        rerender(<Component b={50} />)
        rerender(<Component b={50} />)
        await nextFrame()
        expect(container.firstChild).toHaveStyle("opacity: 0.4")
        rerender(<Component b={50} d={0.5} />)
        rerender(<Component b={50} d={0.5} />)
        await nextFrame()
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

    await nextFrame()
    expect(container.firstChild as Element).toHaveStyle(
        "transform: translateX(4px)"
    )

    rerender(<Component target={a} />)
    await nextFrame()
    expect(container.firstChild as Element).toHaveStyle(
        "transform: translateX(2px)"
    )
})

describe("CSS logical properties", () => {
    test("support numeric values with useTransform", async () => {
        const Component = () => {
            const scrollY = useMotionValue(0)
            const paddingBlock = useTransform(scrollY, [0, 100], [0, 100])
            return <motion.div style={{ paddingBlock }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("padding-block: 0px")
    })

    test("updates paddingBlock when MotionValue changes", async () => {
        const scrollY = motionValue(0)

        const Component = () => {
            const paddingBlock = useTransform(scrollY, [0, 100], [0, 100])
            return <motion.div style={{ paddingBlock }} />
        }

        const { container } = render(<Component />)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("padding-block: 0px")

        scrollY.set(50)
        await nextFrame()
        expect(container.firstChild).toHaveStyle("padding-block: 50px")
    })

    test("supports other CSS logical properties", async () => {
        const Component = () => {
            const v = useMotionValue(25)

            return (
                <motion.div
                    style={{
                        paddingInline: useTransform(v, [0, 100], [0, 100]),
                        marginBlock: useTransform(v, [0, 100], [0, 100]),
                    }}
                />
            )
        }

        const { container } = render(<Component />)

        expect(container.firstChild).toHaveStyle("padding-inline: 25px")
        expect(container.firstChild).toHaveStyle("margin-block: 25px")
    })

    test("supports inset shorthand with numeric values", async () => {
        const Component = () => {
            const scrollY = useMotionValue(0)
            const inset = useTransform(scrollY, [0, 100], [0, 100])
            return <motion.div style={{ inset }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("inset: 0px")
    })

    test("updates inset when MotionValue changes", async () => {
        const scrollY = motionValue(0)

        const Component = () => {
            const inset = useTransform(scrollY, [0, 100], [0, 100])
            return <motion.div style={{ inset }} />
        }

        const { container } = render(<Component />)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("inset: 0px")

        scrollY.set(50)
        await nextFrame()
        expect(container.firstChild).toHaveStyle("inset: 50px")
    })

    test("supports other inset logical properties", async () => {
        const Component = () => {
            const v = useMotionValue(30)

            return (
                <motion.div
                    style={{
                        insetBlock: useTransform(v, [0, 100], [0, 100]),
                        insetInline: useTransform(v, [0, 100], [0, 100]),
                    }}
                />
            )
        }

        const { container } = render(<Component />)

        expect(container.firstChild).toHaveStyle("inset-block: 30px")
        expect(container.firstChild).toHaveStyle("inset-inline: 30px")
    })
})

describe("as output map", () => {
    test("sets initial values", async () => {
        const Component = () => {
            const x = useMotionValue(100)
            const { opacity, scale } = useTransform(x, [0, 200], {
                opacity: [0, 1],
                scale: [0.5, 1],
            })
            return <motion.div style={{ x, opacity, scale }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("opacity: 0.5")
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(100px) scale(0.75)"
        )
    })

    test("updates values when input changes", async () => {
        const x = motionValue(100)

        const Component = () => {
            const { opacity, scale } = useTransform(x, [0, 200], {
                opacity: [0, 1],
                scale: [0.5, 1.5],
            })
            return <motion.div style={{ x, opacity, scale }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("opacity: 0.5")
        expect(container.firstChild).toHaveStyle("transform: translateX(100px)")

        x.set(200)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("opacity: 1")
        expect(container.firstChild).toHaveStyle(
            "transform: translateX(200px) scale(1.5)"
        )
    })

    test("works with color values", async () => {
        const Component = () => {
            const progress = useMotionValue(0.5)
            const { backgroundColor, borderColor } = useTransform(
                progress,
                [0, 1],
                {
                    backgroundColor: ["#ff0000", "#0000ff"],
                    borderColor: ["#000000", "#ffffff"],
                }
            )
            return <motion.div style={{ backgroundColor, borderColor }} />
        }

        const { container } = render(<Component />)
        // Colors are interpolated
        expect(container.firstChild).toHaveStyle(
            "background-color: rgba(180, 0, 180, 1)"
        )
    })

    test("supports transform options", async () => {
        const Component = () => {
            const x = useMotionValue(250)
            const { opacity } = useTransform(
                x,
                [0, 200],
                {
                    opacity: [0, 0.5],
                },
                { clamp: false }
            )
            return <motion.div style={{ opacity }} />
        }

        const { container } = render(<Component />)
        // Value exceeds 0.5 because clamp is false (250/200 * 0.5 = 0.625)
        expect(container.firstChild).toHaveStyle("opacity: 0.625")
    })

    test("maintains keys across renders even if outputMap keys change", async () => {
        let capturedKeys: string[] = []

        const Component = ({ includeExtra }: { includeExtra: boolean }) => {
            const x = useMotionValue(100)

            // Note: In practice, users should not change keys, but the hook
            // should handle this gracefully by using the original keys
            const outputMap: { [key: string]: number[] } = includeExtra
                ? { opacity: [0, 1], scale: [0.5, 1], rotation: [0, 360] }
                : { opacity: [0, 1], scale: [0.5, 1] }

            const result = useTransform(x, [0, 200], outputMap)

            if (capturedKeys.length === 0) {
                capturedKeys = Object.keys(result)
            }

            return <motion.div style={{ opacity: result.opacity }} />
        }

        const { rerender } = render(<Component includeExtra={false} />)

        // The keys should be captured on first render
        expect(capturedKeys).toEqual(["opacity", "scale"])

        // Even if we try to add a new key, it won't be in the result
        rerender(<Component includeExtra={true} />)
    })

    test("responds to input range changes", async () => {
        const x = motionValue(100)

        const Component = ({ max }: { max: number }) => {
            const { opacity } = useTransform(x, [0, max], {
                opacity: [0, 1],
            })
            return <motion.div style={{ opacity }} />
        }

        const { container, rerender } = render(<Component max={200} />)
        expect(container.firstChild).toHaveStyle("opacity: 0.5")

        rerender(<Component max={100} />)
        await nextMicrotask()
        expect(container.firstChild).toHaveStyle("opacity: 1")
    })

    test("is correctly typed", async () => {
        const Component = () => {
            const x = useMotionValue(0)
            const { opacity, scale } = useTransform(x, [0, 1], {
                opacity: [0, 1],
                scale: [0.5, 1],
            })

            return <motion.div style={{ x, opacity, scale }} />
        }

        render(<Component />)
    })

    test("works with mixed types (string and number outputs)", async () => {
        const progress = motionValue(50)

        const Component = () => {
            const { filter, scale, opacity } = useTransform(
                progress,
                [0, 100],
                {
                    filter: ["blur(10px)", "blur(0px)"],
                    scale: [0.5, 1],
                    opacity: [0.5, 1],
                }
            )
            return <motion.div style={{ filter, scale, opacity }} />
        }

        const { container } = render(<Component />)
        expect(container.firstChild).toHaveStyle("filter: blur(5px)")
        expect(container.firstChild).toHaveStyle("opacity: 0.75")
        expect(container.firstChild).toHaveStyle("transform: scale(0.75)")

        progress.set(0)

        await nextFrame()
        expect(container.firstChild).toHaveStyle("filter: blur(10px)")
        expect(container.firstChild).toHaveStyle("opacity: 0.5")
        expect(container.firstChild).toHaveStyle("transform: scale(0.5)")
    })
})

/**
 * #3769: under Strict Mode, setting a source in an effect schedules an
 * update that the Strict Mode cleanup cancels. The effect then re-runs
 * without a render and sets the same value, so no change is emitted and
 * the derived value would be stuck at its initial value.
 */
describe("source set in an effect under Strict Mode", () => {
    const check = async (
        useDerived: (x: MotionValue<number>) => MotionValue<any>,
        expected: any
    ) => {
        let x: MotionValue<number> | undefined
        let derived: MotionValue<any> | undefined

        const Component = () => {
            x = useMotionValue(0)
            derived = useDerived(x)
            useEffect(() => x!.set(10), [])
            return null
        }

        render(<Component />)
        await nextFrame()
        await nextFrame()

        expect(x!.get()).toBe(10)
        expect(derived!.get()).toBe(expected)
    }

    test("useTransform(fn)", () =>
        check((x) => useTransform(() => x.get() * 2), 20))

    test("useTransform(value, fn)", () =>
        check((x) => useTransform(x, (v) => v * 2), 20))

    test("useTransform([values], fn)", () =>
        check((x) => useTransform([x], ([v]: number[]) => v * 2), 20))

    test("useMotionTemplate", () =>
        check((x) => useMotionTemplate`${x}px`, "10px"))

    test("source set in a child's layout effect, before parent subscribes", async () => {
        let derived: MotionValue<number> | undefined

        const Child = ({ x }: { x: MotionValue<number> }) => {
            useLayoutEffect(() => x.set(10), [])
            return null
        }

        const Component = () => {
            const x = useMotionValue(0)
            derived = useTransform(() => x.get() * 2)
            return <Child x={x} />
        }

        render(<Component />, false)
        await nextFrame()
        await nextFrame()

        expect(derived!.get()).toBe(20)
    })
})

/**
 * #3913: a source changed between render and subscription (here from a
 * child's insertion effect, which runs before the parent's effects) must
 * still reach the derived value and the element, without Strict Mode.
 */
test("useTransform(fn) sees a source change made before it subscribes", async () => {
    let source!: MotionValue<number>
    let t!: MotionValue<number>

    const SetSource = ({ v }: { v: MotionValue<number> }) => {
        useInsertionEffect(() => v.set(100), [])
        return null
    }

    const C = () => {
        source = useMotionValue(0)
        t = useTransform(() => source.get() + 1)
        return (
            <motion.div data-testid="el" style={{ x: t }}>
                <SetSource v={source} />
            </motion.div>
        )
    }

    const { getByTestId } = render(<C />, false)
    for (let i = 0; i < 5; i++) await nextFrame()

    expect(t.get()).toBe(101)
    expect(getByTestId("el").style.transform).toContain("101px")
})
