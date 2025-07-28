import { motionValue, stagger, Variants } from "motion-dom"
import { Fragment, memo, useEffect, useState } from "react"
import { frame, motion, MotionConfig, useMotionValue } from "../../"
import { nextFrame } from "../../gestures/__tests__/utils"
import { pointerDown, pointerEnter, pointerUp, render } from "../../jest.setup"

const MotionFragment = motion.create(Fragment)

describe("animate prop as variant", () => {
    test("animates to set variant", async () => {
        const variants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 100, transition: { type: false } },
        }

        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const { rerender } = render(
                <motion.div
                    animate="visible"
                    variants={variants}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
            rerender(
                <motion.div
                    animate="visible"
                    variants={variants}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
        })

        return expect(promise).resolves.toBe(100)
    })

    test("fires onAnimationStart when animation begins", async () => {
        const promise = new Promise((resolve) => {
            const onStart = jest.fn()
            const onComplete = () => resolve(onStart)
            const Component = () => (
                <motion.div
                    animate="visible"
                    transition={{ type: false }}
                    onAnimationStart={onStart}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBeCalledTimes(1)
    })

    test("fires onAnimationStart with the animation definition", async () => {
        const promise = new Promise((resolve) => {
            const onStart = jest.fn()
            const onComplete = () => resolve(onStart)
            const Component = () => (
                <motion.div
                    animate="visible"
                    transition={{ type: false }}
                    onAnimationStart={(definition) => onStart(definition)}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBeCalledWith("visible")
    })

    test("child animates to set variant", async () => {
        const variants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 100, transition: { type: false } },
        }

        const childVariants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 50, transition: { type: false } },
        }

        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const Component = () => (
                <motion.div
                    animate="visible"
                    variants={variants}
                    onAnimationComplete={onComplete}
                >
                    <motion.div variants={childVariants} style={{ x }} />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(50)
    })

    test("child animates to set variant even if variants are not found on parent", async () => {
        const childVariants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 50, transition: { type: false } },
        }

        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const Component = () => (
                <motion.div animate="visible" onAnimationComplete={onComplete}>
                    <motion.div variants={childVariants} style={{ x }} />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(50)
    })

    test("applies applyOnEnd if set on initial", () => {
        const variants: Variants = {
            visible: {
                background: "#f00",
                transitionEnd: { display: "none" },
            },
        }

        const { container } = render(
            <motion.div variants={variants} initial="visible" />
        )
        expect(container.firstChild).toHaveStyle("display: none")
    })

    test("applies applyOnEnd and end of animation", async () => {
        const promise = new Promise((resolve) => {
            const variants: Variants = {
                hidden: { background: "#00f" },
                visible: {
                    background: "#f00",
                    transitionEnd: { display: "none" },
                },
            }
            const display = motionValue("block")
            const onComplete = () => {
                frame.postRender(() => resolve(display.get()))
            }
            const Component = () => (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={variants}
                    transition={{ type: false }}
                    onAnimationComplete={onComplete}
                    style={{ display }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe("none")
    })

    test("accepts custom transition", async () => {
        const promise = new Promise((resolve) => {
            const variants: Variants = {
                hidden: { background: "#00f" },
                visible: {
                    background: "#f00",
                    transition: { from: "#555", ease: () => 0.5 },
                },
            }
            const background = motionValue("#00f")
            const onComplete = () => resolve(background.get())
            const Component = () => (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={variants}
                    transition={{ type: false }}
                    onUpdate={onComplete}
                    style={{ background }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe("rgba(190, 60, 60, 1)")
    })

    test("respects orchestration props in transition prop", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(0)

            const { getByTestId } = render(
                <motion.div
                    variants={{
                        visible: {
                            opacity: 1,
                        },
                        hidden: {
                            opacity: 0,
                        },
                    }}
                    initial="hidden"
                    animate="visible"
                    transition={{ type: false, delayChildren: 1 }}
                >
                    <motion.div
                        data-testid="test"
                        variants={{
                            visible: {
                                opacity: 0.9,
                            },
                            hidden: {
                                opacity: 0,
                            },
                        }}
                        transition={{ type: false }}
                        style={{ opacity }}
                    />
                </motion.div>
            )

            requestAnimationFrame(() => resolve(getByTestId("test")))
        })

        return expect(promise).resolves.toHaveStyle("opacity: 0")
    })

    test("delay propagates throughout children", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(0)
            const variants: Variants = {
                visible: {
                    opacity: 1,
                },
                hidden: {
                    opacity: 0,
                },
            }

            function Component() {
                return (
                    <motion.div
                        variants={variants}
                        initial="hidden"
                        animate="visible"
                        transition={{ type: false, delayChildren: 1 }}
                    >
                        <motion.div
                            variants={variants}
                            transition={{ type: false }}
                        >
                            <motion.div
                                variants={variants}
                                style={{ opacity }}
                            />
                        </motion.div>
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)

            setTimeout(() => resolve(opacity.get()), 300)
        })

        return expect(promise).resolves.toBe(0)
    })

    test("propagates through components with no `animate` prop", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(0)
            const variants: Variants = {
                visible: {
                    opacity: 1,
                },
            }

            render(
                <motion.div
                    variants={variants}
                    initial="hidden"
                    animate="visible"
                    transition={{ type: false }}
                >
                    <motion.div>
                        <motion.div
                            variants={variants}
                            transition={{ type: false }}
                            style={{ opacity }}
                        />
                    </motion.div>
                </motion.div>
            )

            requestAnimationFrame(() => resolve(opacity.get()))
        })

        return expect(promise).resolves.toBe(1)
    })

    test("doesn't propagate to a component with its own `animate` prop", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(1)

            const parentVariants = {
                initial: {
                    x: 0,
                },
                animate: {
                    x: 100,
                },
            }

            const childVariants = {
                initial: {
                    opacity: 0,
                },
                animate: {
                    opacity: 1,
                },
            }

            render(
                <motion.div
                    initial="initial"
                    animate="animate"
                    variants={parentVariants}
                    transition={{ duration: 0.05 }}
                >
                    <motion.div
                        animate="initial"
                        variants={childVariants}
                        style={{ opacity }}
                        transition={{ duration: 0.05 }}
                    />
                </motion.div>
            )

            setTimeout(() => resolve(opacity.get()), 100)
        })

        return expect(promise).resolves.toBe(0)
    })

    test("when: beforeChildren works correctly", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(0.1)
            const variants: Variants = {
                visible: {
                    opacity: 1,
                    transition: { duration: 1, when: "beforeChildren" },
                },
            }

            render(
                <motion.div
                    variants={variants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div>
                        <motion.div variants={variants} style={{ opacity }} />
                    </motion.div>
                </motion.div>
            )

            setTimeout(() => resolve(opacity.get()), 200)
        })

        return expect(promise).resolves.toBe(0.1)
    })

    test("when: afterChildren works correctly", async () => {
        const parentOpacity = motionValue(0.1)
        const childOpacity = motionValue(0.1)
        const variants: Variants = {
            hidden: {
                opacity: 0,
                display: "block",
            },
            visible: {
                opacity: 1,
                transitionEnd: {
                    display: "none",
                },
            },
        }
        const Component = ({
            animate,
            onAnimationComplete,
        }: {
            animate: string
            onAnimationComplete?: VoidFunction
        }) => {
            return (
                <motion.div
                    variants={variants}
                    initial={false}
                    transition={{ duration: 0.1, when: "afterChildren" }}
                    animate={animate}
                    style={{ opacity: parentOpacity }}
                    onAnimationComplete={onAnimationComplete}
                >
                    <motion.div>
                        <motion.div
                            variants={variants}
                            transition={{ duration: 0.1 }}
                            style={{ opacity: childOpacity }}
                        />
                    </motion.div>
                </motion.div>
            )
        }

        return await new Promise<void>(async (resolve) => {
            const { rerender } = render(<Component animate="hidden" />)
            rerender(
                <Component
                    animate="visible"
                    onAnimationComplete={() => {
                        expect(parentOpacity.get()).toBe(1)
                        expect(childOpacity.get()).toBe(1)

                        rerender(
                            <Component
                                animate="hidden"
                                onAnimationComplete={() => {
                                    expect(parentOpacity.get()).toBe(0)
                                    expect(childOpacity.get()).toBe(0)

                                    resolve()
                                }}
                            />
                        )
                        setTimeout(() => {
                            expect(parentOpacity.get()).toBe(1)
                            expect(childOpacity.get()).not.toBe(1)
                        }, 50)
                    }}
                />
            )
            setTimeout(() => {
                expect(parentOpacity.get()).toBe(0)
                expect(childOpacity.get()).not.toBe(0)
            }, 50)
        })
    })

    /**
     * This test enshrines the behaviour that when a value is removed from an element as the result of a parent variant,
     * it should fallback to the style prop. This is a bug in Motion - the desired behaviour is that it falls
     * back to the defined variant in initial. However, changing this behaviour would break generated code in Framer
     * so we can't fix it until we find a migration path out of that.
     */
    test("FRAMER BUG: When a value is removed from an element as the result of a parent variant, fallback to style", async () => {
        const Component = ({ animate }: { animate?: string }) => {
            return (
                <MotionFragment initial="a" animate={animate}>
                    <motion.div
                        data-testid="child"
                        variants={{
                            a: { opacity: 0.5 },
                            b: { opacity: 1 },
                            c: {},
                        }}
                        transition={{ type: false }}
                        style={{ opacity: 0 }}
                    />
                </MotionFragment>
            )
        }

        const { getByTestId, rerender } = render(<Component />)
        const element = getByTestId("child")
        expect(element).toHaveStyle("opacity: 0.5")

        rerender(<Component animate="a" />)
        rerender(<Component animate="a" />)

        await nextFrame()

        expect(element).toHaveStyle("opacity: 0.5")

        rerender(<Component animate="b" />)
        rerender(<Component animate="b" />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 1")

        rerender(<Component animate="c" />)
        rerender(<Component animate="c" />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 0") // Contained in variant a, which is set as initial
    })

    test("initial: false correctly propagates", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(0.5)

            render(
                <motion.div initial={false} animate="visible">
                    <motion.div>
                        <motion.div
                            variants={{
                                visible: { opacity: 0.9 },
                                hidden: { opacity: 0 },
                            }}
                            style={{ opacity }}
                        />
                    </motion.div>
                </motion.div>
            )

            setTimeout(() => resolve(opacity.get()), 200)
        })

        return expect(promise).resolves.toBe(0.9)
    })

    test("initial=false doesn't propagate to props", async () => {
        const { getByTestId } = render(
            <motion.div initial={false} animate="test">
                <motion.div data-testid="child" animate={{ opacity: 0.4 }} />
            </motion.div>
        )

        expect(getByTestId("child")).not.toHaveStyle("opacity: 0.4")
    })

    test("nested controlled variants switch correctly", async () => {
        const promise = new Promise(async (resolve) => {
            const parentOpacity = motionValue(0.2)
            const childOpacity = motionValue(0.1)

            const Component = ({ isOpen }: { isOpen: boolean }) => {
                return (
                    <motion.div
                        variants={{
                            visible: { opacity: 0.3 },
                            hidden: { opacity: 0.4 },
                        }}
                        initial="hidden"
                        animate={isOpen ? "visible" : "hidden"}
                        transition={{ type: false }}
                        style={{ opacity: parentOpacity }}
                    >
                        <motion.div
                            variants={{
                                visible: { opacity: 0.5 },
                                hidden: { opacity: 0.6 },
                            }}
                            initial="hidden"
                            transition={{ type: false }}
                            animate={isOpen ? "visible" : "hidden"}
                            style={{ opacity: childOpacity }}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component isOpen={false} />)

            await nextFrame()

            expect(parentOpacity.get()).toBe(0.4)
            expect(childOpacity.get()).toBe(0.6)

            rerender(<Component isOpen />)

            await nextFrame()

            resolve([parentOpacity.get(), childOpacity.get()])
        })

        return expect(promise).resolves.toEqual([0.3, 0.5])
    })

    test("Child variants correctly calculate delay based on delayChildren: stagger()", async () => {
        const isCorrectlyStaggered = await new Promise((resolve) => {
            const childVariants = {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.1 } },
            }

            function Component() {
                const a = useMotionValue(0)
                const b = useMotionValue(0)

                useEffect(
                    () =>
                        a.on("change", (latest) => {
                            if (latest >= 1 && b.get() === 0) resolve(true)
                        }),
                    [a, b]
                )

                return (
                    <motion.div
                        variants={{
                            hidden: {},
                            visible: {
                                x: 100,
                                transition: { delayChildren: stagger(0.15) },
                            },
                        }}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: a }}
                        />
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: b }}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(isCorrectlyStaggered).toBe(true)
    })

    test("Child variants with value-specific transitions correctly calculate delay based on delayChildren: stagger()", async () => {
        const isCorrectlyStaggered = await new Promise((resolve) => {
            const childVariants = {
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { opacity: { duration: 0.1 } },
                },
            }

            function Component() {
                const a = useMotionValue(0)
                const b = useMotionValue(0)

                useEffect(
                    () =>
                        a.on("change", (latest) => {
                            if (latest >= 1 && b.get() === 0) resolve(true)
                        }),
                    [a, b]
                )

                return (
                    <motion.div
                        variants={{
                            hidden: {},
                            visible: {
                                x: 100,
                                transition: { delayChildren: stagger(0.15) },
                            },
                        }}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: a }}
                        />
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: b }}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(isCorrectlyStaggered).toBe(true)
    })

    test("Child variants correctly calculate delay based on staggerChildren (deprecated)", async () => {
        const isCorrectlyStaggered = await new Promise((resolve) => {
            const childVariants = {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.1 } },
            }

            function Component() {
                const a = useMotionValue(0)
                const b = useMotionValue(0)

                useEffect(
                    () =>
                        a.on("change", (latest) => {
                            if (latest >= 1 && b.get() === 0) resolve(true)
                        }),
                    [a, b]
                )

                return (
                    <motion.div
                        variants={{
                            hidden: {},
                            visible: {
                                x: 100,
                                transition: { staggerChildren: 0.15 },
                            },
                        }}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: a }}
                        />
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: b }}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(isCorrectlyStaggered).toBe(true)
    })

    test("Child variants with value-specific transitions correctly calculate delay based on staggerChildren (deprecated)", async () => {
        const isCorrectlyStaggered = await new Promise((resolve) => {
            const childVariants = {
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { opacity: { duration: 0.1 } },
                },
            }

            function Component() {
                const a = useMotionValue(0)
                const b = useMotionValue(0)

                useEffect(
                    () =>
                        a.on("change", (latest) => {
                            if (latest >= 1 && b.get() === 0) resolve(true)
                        }),
                    [a, b]
                )

                return (
                    <motion.div
                        variants={{
                            hidden: {},
                            visible: {
                                x: 100,
                                transition: { staggerChildren: 0.15 },
                            },
                        }}
                        initial="hidden"
                        animate="visible"
                    >
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: a }}
                        />
                        <motion.div
                            variants={childVariants}
                            style={{ opacity: b }}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(isCorrectlyStaggered).toBe(true)
    })

    test("components without variants are transparent to stagger order", async () => {
        const [recordedOrder, staggeredEqually] = await new Promise<
            [number[], boolean]
        >((resolve) => {
            const order: number[] = []
            const delayedBy: number[] = []
            const staggerDuration = 0.1

            const updateDelayedBy = (i: number) => {
                if (delayedBy[i]) return
                delayedBy[i] = performance.now()
            }

            // Checking a rough equidistance between stagger times allows us to see
            // if any of the supposedly invisible interim `motion.div`s were considered part of the
            // stagger order (which would mess up the timings)
            const checkStaggerEquidistance = () => {
                let isEquidistant = true
                let prev = 0
                for (let i = 0; i < delayedBy.length; i++) {
                    if (prev) {
                        const timeSincePrev = prev - delayedBy[i]
                        if (
                            Math.round(timeSincePrev / 100) * 100 !==
                            staggerDuration * 1000
                        ) {
                            isEquidistant = false
                        }
                    }
                    prev = delayedBy[i]
                }

                return isEquidistant
            }

            const parentVariants: Variants = {
                visible: {
                    transition: {
                        staggerChildren: staggerDuration,
                        staggerDirection: -1,
                    },
                },
            }

            const variants: Variants = {
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        duration: 0.000001,
                    },
                },
            }

            render(
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={parentVariants}
                    onAnimationComplete={() =>
                        requestAnimationFrame(() =>
                            resolve([order, checkStaggerEquidistance()])
                        )
                    }
                >
                    <motion.div>
                        <motion.div />
                        <motion.div
                            variants={variants}
                            onUpdate={() => {
                                updateDelayedBy(0)
                                order.push(1)
                            }}
                            style={{ willChange: "auto" }}
                        />
                        <motion.div
                            variants={variants}
                            onUpdate={() => {
                                updateDelayedBy(1)
                                order.push(2)
                            }}
                            style={{ willChange: "auto" }}
                        />
                    </motion.div>
                    <motion.div>
                        <motion.div
                            variants={variants}
                            onUpdate={() => {
                                updateDelayedBy(2)
                                order.push(3)
                            }}
                            style={{ willChange: "auto" }}
                        />
                        <motion.div
                            variants={variants}
                            onUpdate={() => {
                                updateDelayedBy(3)
                                order.push(4)
                            }}
                            style={{ willChange: "auto" }}
                        />
                    </motion.div>
                </motion.div>
            )
        })

        expect(recordedOrder).toEqual([4, 3, 2, 1])
        expect(staggeredEqually).toEqual(true)
    })

    test("onUpdate", async () => {
        const promise = new Promise((resolve) => {
            let latest = {}

            const onUpdate = (l: { [key: string]: number | string }) => {
                latest = l
            }

            const Component = () => (
                <motion.div
                    onUpdate={onUpdate}
                    initial={{ x: 0, y: 0 }}
                    animate={{ x: 100, y: 100 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(latest))
                    }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toEqual({
            x: 100,
            y: 100,
        })
    })

    test("onUpdate doesnt fire if no values have changed", async () => {
        const onUpdate = jest.fn()

        await new Promise<void>((resolve) => {
            const x = motionValue(0)

            const Component = ({ xTarget = 0 }) => (
                <motion.div
                    animate={{ x: xTarget }}
                    transition={{ type: false }}
                    onUpdate={(latest) => {
                        expect(latest.willChange).not.toBe("auto")
                        onUpdate(latest)
                    }}
                    // Manually setting willChange to avoid triggering onUpdate
                    style={{ x, willChange: "transform" }}
                />
            )

            const { rerender } = render(<Component xTarget={0} />)
            setTimeout(() => rerender(<Component xTarget={1} />), 30)
            setTimeout(() => rerender(<Component xTarget={1} />), 60)
            setTimeout(() => resolve(), 90)
        })

        expect(onUpdate).toHaveBeenCalledTimes(1)
    })

    test("new child items animate from initial to animate", async () => {
        const x = motionValue(0)
        const Component = ({ length }: { length: number }) => {
            const variants: Variants = {
                hidden: { opacity: 0, x: -100, transition: { type: false } },
                visible: { opacity: 1, x: 100, transition: { type: false } },
            }

            const items = []
            for (let i = 0; i < length; i++) {
                items.push(
                    <motion.div
                        key={i}
                        variants={variants}
                        style={{ x: i === 1 ? x : 0 }}
                    />
                )
            }

            return (
                <motion.div initial="hidden" animate="visible">
                    <motion.div>{items}</motion.div>
                </motion.div>
            )
        }

        const { rerender } = render(<Component length={1} />)
        rerender(<Component length={1} />)
        rerender(<Component length={2} />)
        rerender(<Component length={2} />)

        await nextFrame()

        expect(x.get()).toBe(100)
    })

    test("style is used as fallback when a variant is removed from animate", async () => {
        const Component = ({ animate }: { animate?: string }) => {
            return (
                <motion.div
                    animate={animate}
                    variants={{ a: { opacity: 1 } }}
                    transition={{ type: false }}
                    style={{ opacity: 0 }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        const element = container.firstChild as Element
        expect(element).toHaveStyle("opacity: 0")

        rerender(<Component animate="a" />)
        rerender(<Component animate="a" />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 1")

        rerender(<Component />)
        rerender(<Component />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 0")
    })

    test("style is active once value has been removed from animate", async () => {
        const Component = ({
            animate,
            opacity = 0,
        }: {
            animate?: string
            opacity?: number
        }) => {
            return (
                <motion.div
                    animate={animate}
                    variants={{ a: { opacity: 1, rotate: 1 } }}
                    transition={{ type: false }}
                    style={{ opacity, rotate: opacity }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        const element = container.firstChild as Element
        expect(element).toHaveStyle("opacity: 0")
        expect(element).toHaveStyle("transform: none")

        rerender(<Component animate="a" />)
        rerender(<Component animate="a" />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 1")
        expect(element).toHaveStyle("transform: rotate(1deg)")

        rerender(<Component />)
        rerender(<Component />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 0")
        expect(element).toHaveStyle("transform: none")

        rerender(<Component opacity={0.5} />)
        rerender(<Component opacity={0.5} />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 0.5")
        expect(element).toHaveStyle("transform: rotate(0.5deg)")

        // Re-adding value to animated stack will animate value correctly
        rerender(<Component animate="a" opacity={0.5} />)
        rerender(<Component animate="a" opacity={0.5} />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 1")
        expect(element).toHaveStyle("transform: rotate(1deg)")

        // While animate is active, changing style doesn't change value
        rerender(<Component animate="a" opacity={0.75} />)
        rerender(<Component animate="a" opacity={0.75} />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 1")
        expect(element).toHaveStyle("transform: rotate(1deg)")
    })

    test("variants work the same whether defined inline or not", async () => {
        const variants = {
            foo: { opacity: [1, 0, 1] },
        }
        const outputA: number[] = []
        const outputB: number[] = []
        const Component = ({
            activeVariants,
        }: {
            activeVariants: string[]
        }) => {
            return (
                <>
                    <motion.div
                        className="box bg-blue"
                        animate={activeVariants}
                        variants={{
                            foo: {
                                opacity: [1, 0, 1],
                            },
                        }}
                        transition={{ duration: 0.1 }}
                        onUpdate={({ opacity }) =>
                            outputA.push(opacity as number)
                        }
                    />
                    <motion.div
                        className="box bg-green"
                        animate={activeVariants}
                        variants={variants}
                        transition={{ duration: 0.1 }}
                        onUpdate={({ opacity }) =>
                            outputB.push(opacity as number)
                        }
                    />
                </>
            )
        }

        const { rerender } = render(<Component activeVariants={["foo"]} />)
        rerender(<Component activeVariants={["foo"]} />)
        await new Promise((resolve) => {
            setTimeout(() => {
                rerender(<Component activeVariants={["foo", "bar"]} />)
                setTimeout(resolve, 100)
            }, 100)
        })

        expect(outputA.length).toEqual(outputB.length)
    })

    test("style is used as fallback when a variant changes to not contain that style", async () => {
        const Component = ({ animate }: { animate?: string }) => {
            return (
                <motion.div
                    animate={animate}
                    variants={{ a: { opacity: 1 }, b: { x: 100 } }}
                    transition={{ type: false }}
                    style={{ opacity: 0 }}
                />
            )
        }

        const { container, rerender } = render(<Component />)
        const element = container.firstChild as Element
        expect(element).toHaveStyle("opacity: 0")

        rerender(<Component animate="a" />)
        rerender(<Component animate="a" />)

        await nextFrame()

        expect(element).toHaveStyle("opacity: 1")

        rerender(<Component animate="b" />)
        rerender(<Component animate="b" />)

        await nextFrame()
        expect(element).toHaveStyle("opacity: 0")
    })

    test("Children correctly animate to removed values even when not rendering along with parents", async () => {
        const Child = memo(() => (
            <motion.div
                variants={{
                    visible: { x: 100, opacity: 1 },
                    hidden: { opacity: 0 },
                }}
                transition={{ type: false }}
            />
        ))

        const Parent = ({ isVisible }: { isVisible: boolean }) => {
            return (
                <motion.div
                    initial={{ x: 0 }}
                    animate={isVisible ? "visible" : "hidden"}
                >
                    <Child />
                </motion.div>
            )
        }

        const { container, rerender } = render(<Parent isVisible={false} />)
        const element = container.firstChild?.firstChild as Element

        rerender(<Parent isVisible={true} />)

        await nextFrame()

        expect(element).toHaveStyle("transform: translateX(100px)")
        rerender(<Parent isVisible={false} />)

        await nextFrame()

        expect(element).toHaveStyle("transform: none")
    })

    test("Protected keys don't persist after setActive fires", async () => {
        const Component = () => {
            const [isHover, setIsHover] = useState(false)
            const [_, setIsPressed] = useState(false)
            const [variant, setVariant] = useState("a")

            const variants = [variant]
            if (isHover) variants.push(variant + "-hover")

            return (
                <MotionConfig transition={{ type: false }}>
                    <motion.div
                        data-testid="parent"
                        animate={variants}
                        onHoverStart={() => setIsHover(true)}
                        onHoverEnd={() => setIsHover(false)}
                        onTapStart={() => setIsPressed(true)}
                        onTap={() => setIsPressed(false)}
                        onTapCancel={() => setIsPressed(false)}
                    >
                        <motion.div
                            data-testid="variant-trigger"
                            onTap={() => setVariant("b")}
                            style={{
                                width: 300,
                                height: 300,
                                backgroundColor: "rgb(255,255,0)",
                            }}
                            variants={{
                                b: {
                                    backgroundColor: "rgb(0,255,255)",
                                },
                            }}
                        >
                            <motion.div
                                data-testid="inner"
                                style={{
                                    width: 100,
                                    height: 100,
                                    backgroundColor: "rgb(255,255,0)",
                                }}
                                variants={{
                                    // This state lingers too long.
                                    "a-hover": {
                                        backgroundColor: "rgb(150,150,0)",
                                    },
                                    b: {
                                        backgroundColor: "rgb(0,255,255)",
                                    },
                                    "b-hover": {
                                        backgroundColor: "rgb(0, 150,150)",
                                    },
                                }}
                            />
                        </motion.div>
                    </motion.div>
                </MotionConfig>
            )
        }

        const { getByTestId } = render(<Component />)
        const inner = getByTestId("inner")
        expect(inner).toHaveStyle("background-color: rgb(255,255,0)")

        pointerEnter(getByTestId("parent"))

        await nextFrame()
        await nextFrame()
        await nextFrame()

        expect(inner).toHaveStyle("background-color: rgb(150,150,0)")

        pointerDown(getByTestId("variant-trigger"))
        pointerUp(getByTestId("variant-trigger"))

        await nextFrame()
        await nextFrame()
        await nextFrame()

        expect(inner).toHaveStyle("background-color: rgb(0, 150,150)")
    })

    test("child onAnimationComplete triggers from parent animations", async () => {
        const variants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 100, transition: { type: false } },
        }

        const childVariants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 50, transition: { type: false } },
        }

        const promise = new Promise<string>((resolve) => {
            const onStart = (name: string) => resolve(name)
            const Component = () => (
                <motion.div animate="visible" variants={variants}>
                    <motion.div
                        variants={childVariants}
                        onAnimationStart={onStart}
                    />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe("visible")
    })

    test("child onAnimationComplete triggers from parent animations", async () => {
        const variants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 100, transition: { type: false } },
        }

        const childVariants: Variants = {
            hidden: { opacity: 0, x: -100, transition: { type: false } },
            visible: { opacity: 1, x: 50, transition: { type: false } },
        }

        const promise = new Promise<string>((resolve) => {
            const onComplete = (name: string) => resolve(name)
            const Component = () => (
                <motion.div animate="visible" variants={variants}>
                    <motion.div
                        variants={childVariants}
                        onAnimationComplete={onComplete}
                    />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe("visible")
    })

    test("changing values within an inherited variant triggers an animation", async () => {
        const Component = ({ x }: { x: number }) => {
            return (
                <motion.div initial={false} animate="variant">
                    <motion.div
                        data-testid="element"
                        variants={{ variant: { x } }}
                        transition={{ type: false }}
                    />
                </motion.div>
            )
        }

        const { rerender, getByTestId } = render(<Component x={0} />)

        await nextFrame()

        const element = getByTestId("element")

        expect(element).toHaveStyle("transform: none")

        rerender(<Component x={100} />)

        await nextFrame()

        expect(element).toHaveStyle("transform: translateX(100px)")
    })

    test("staggerChildren is calculated correctly for new children", async () => {
        const Component = ({ items }: { items: string[] }) => {
            return (
                <motion.div
                    animate="enter"
                    variants={{
                        enter: { transition: { delayChildren: stagger(0.1) } },
                    }}
                >
                    {items.map((item) => (
                        <motion.div
                            key={item}
                            id={item}
                            className="item"
                            variants={{ enter: { opacity: 1 } }}
                            initial={{ opacity: 0 }}
                        />
                    ))}
                </motion.div>
            )
        }

        const { rerender } = render(<Component items={["1", "2"]} />)

        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()

        rerender(<Component items={["1", "2", "3", "4", "5"]} />)

        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        await nextFrame()

        const elements = document.querySelectorAll(".item")

        // Check that none of the opacities are the same
        const opacities = Array.from(elements).map((el) =>
            parseFloat(window.getComputedStyle(el).opacity)
        )

        // All opacities should be unique
        const uniqueOpacities = new Set(opacities)
        expect(uniqueOpacities.size).toBe(opacities.length)
    })
})
