import { motionValue, stagger, Variants } from "motion-dom"
import { motion } from "../.."
import { render } from "../../jest.setup"

describe("delay attr", () => {
    test("in transition prop", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: 10 }}
                    transition={{ delay: 1, type: false }}
                    style={{ x }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("value-specific delay on instant transition", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: 10 }}
                    transition={{ x: { delay: 1, type: false } }}
                    style={{ x }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("value-specific delay on animation", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: 10 }}
                    transition={{ x: { delay: 1 } }}
                    style={{ x }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("in animate.transition", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: 10, transition: { delay: 1, type: false } }}
                    style={{ x }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("in variant", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    variants={{
                        visible: {
                            x: 10,
                            transition: { delay: 1, type: false },
                        },
                    }}
                    animate="visible"
                    style={{ x }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("in variant children via delayChildren", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)

            const parent: Variants = {
                visible: {
                    x: 10,
                    transition: { delay: 0, delayChildren: 1, type: false },
                },
            }

            const child: Variants = {
                visible: {
                    x: 10,
                    transition: { type: false },
                },
            }

            const Component = () => (
                <motion.div variants={parent} animate="visible">
                    <motion.div variants={child} style={{ x }} />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("in variant children via staggerChildren", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)

            const parent: Variants = {
                visible: {
                    x: 10,
                    transition: { delay: 0, staggerChildren: 1, type: false },
                },
            }

            const child: Variants = {
                visible: {
                    x: 10,
                    transition: { type: false },
                },
            }

            const Component = () => (
                <motion.div variants={parent} animate="visible">
                    <motion.div variants={child} />
                    <motion.div variants={child} style={{ x }} />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
    test("in variant children via delayChildren: stagger(interval)", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)

            const parent: Variants = {
                visible: {
                    x: 10,
                    transition: {
                        delay: 0,
                        delayChildren: stagger(1),
                        type: false,
                    },
                },
            }

            const child: Variants = {
                visible: {
                    x: 10,
                    transition: { type: false },
                },
            }

            const Component = () => (
                <motion.div variants={parent} animate="visible">
                    <motion.div variants={child} />
                    <motion.div variants={child} style={{ x }} />
                </motion.div>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)

            requestAnimationFrame(() => resolve(x.get()))
        })

        return expect(promise).resolves.toBe(0)
    })
})

describe("onAnimationPlay", () => {
    test("fires immediately when there is no delay", async () => {
        const promise = new Promise<void>((resolve) => {
            const onAnimationPlay = jest.fn()
            const onAnimationComplete = () => {
                expect(onAnimationPlay).toBeCalledTimes(1)
                resolve()
            }
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    transition={{ type: false }}
                    onAnimationPlay={onAnimationPlay}
                    onAnimationComplete={onAnimationComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return promise
    })

    test("fires after delay when delay is set", async () => {
        const promise = new Promise<void>((resolve) => {
            const onAnimationStart = jest.fn()
            const onAnimationPlay = jest.fn()
            let startTime = 0
            let playTime = 0

            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    transition={{ delay: 0.1, type: false }}
                    onAnimationStart={() => {
                        onAnimationStart()
                        startTime = performance.now()
                    }}
                    onAnimationPlay={() => {
                        onAnimationPlay()
                        playTime = performance.now()
                    }}
                    onAnimationComplete={() => {
                        // onAnimationStart should fire before onAnimationPlay
                        expect(onAnimationStart).toBeCalledTimes(1)
                        expect(onAnimationPlay).toBeCalledTimes(1)
                        // There should be a delay between start and play
                        expect(playTime - startTime).toBeGreaterThanOrEqual(90)
                        resolve()
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return promise
    })

    test("fires once even with multiple properties", async () => {
        const promise = new Promise<void>((resolve) => {
            const onAnimationPlay = jest.fn()
            const Component = () => (
                <motion.div
                    animate={{ x: 20, y: 20, opacity: 0.5 }}
                    transition={{ type: false }}
                    onAnimationPlay={onAnimationPlay}
                    onAnimationComplete={() => {
                        // Should only fire once, not once per property
                        expect(onAnimationPlay).toBeCalledTimes(1)
                        resolve()
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return promise
    })

    test("fires with definition argument", async () => {
        const promise = new Promise<void>((resolve) => {
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    transition={{ type: false }}
                    onAnimationPlay={(definition) => {
                        expect(definition).toEqual({ x: 20 })
                        resolve()
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return promise
    })

    test("fires with variant name when using variants", async () => {
        const promise = new Promise<void>((resolve) => {
            const Component = () => (
                <motion.div
                    variants={{
                        visible: { x: 10, transition: { type: false } },
                    }}
                    animate="visible"
                    onAnimationPlay={(definition) => {
                        expect(definition).toBe("visible")
                        resolve()
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return promise
    })
})
