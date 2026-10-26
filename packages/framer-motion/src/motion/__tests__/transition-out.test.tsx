import { motionValue, Variants } from "motion-dom"
import { AnimatePresence, motion } from "../../"
import {
    pointerDown,
    pointerEnter,
    pointerLeave,
    pointerUp,
    render,
} from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

/**
 * `transition.out` (#1725): the transition a value uses when it leaves a
 * state for a lower-priority one. Instant (`type: false`) transitions are
 * compared against `delay: 10`/`duration: 10` ones, so a frame or two tells
 * them apart however loaded the machine is.
 */
const frames = async (n = 2) => {
    for (let i = 0; i < n; i++) await nextFrame()
}

describe("transition.out", () => {
    test.each([true, false])(
        "initial's out transition is used for the mount animation only (StrictMode: %s)",
        async (isStrict) => {
            const opacity = motionValue(0)
            const Component = ({ target }: { target: number }) => (
                <motion.div
                    initial={{
                        opacity: 0,
                        transition: { out: { type: false } },
                    }}
                    animate={{ opacity: target }}
                    transition={{ delay: 10 }}
                    style={{ opacity }}
                />
            )

            const { rerender } = render(<Component target={1} />, isStrict)
            rerender(<Component target={1} />)
            await frames()

            // initial -> animate uses initial's out transition, no delay
            expect(opacity.get()).toBe(1)

            // Later changes to animate use the normal transition again
            rerender(<Component target={0.5} />)
            await frames()
            expect(opacity.get()).toBe(1)
        }
    )

    test("initial's out transition from a variant label", async () => {
        const opacity = motionValue(0)
        const Component = () => (
            <motion.div
                variants={{
                    hidden: {
                        opacity: 0,
                        transition: { out: { type: false } },
                    },
                    visible: { opacity: 1, transition: { delay: 10 } },
                }}
                initial="hidden"
                animate="visible"
                style={{ opacity }}
            />
        )

        const { rerender } = render(<Component />)
        rerender(<Component />)
        await frames()
        expect(opacity.get()).toBe(1)
    })

    test("variant children use the inherited initial's out transition on mount", async () => {
        const parentOpacity = motionValue(0)
        const childOpacity = motionValue(0)
        const variants: Variants = {
            hidden: { opacity: 0, transition: { out: { type: false } } },
            visible: { opacity: 1, transition: { delay: 10 } },
        }
        const Component = () => (
            <motion.div
                initial="hidden"
                animate="visible"
                variants={variants}
                style={{ opacity: parentOpacity }}
            >
                <motion.div
                    variants={variants}
                    style={{ opacity: childOpacity }}
                />
            </motion.div>
        )

        const { rerender } = render(<Component />)
        rerender(<Component />)
        await frames()
        expect([parentOpacity.get(), childOpacity.get()]).toEqual([1, 1])
    })

    test("initial's out transition doesn't apply to values initial doesn't change on mount", async () => {
        const x = motionValue(0)
        const Component = ({ target }: { target: number }) => (
            <motion.div
                initial={{ x: 0, transition: { out: { type: false } } }}
                animate={{ x: target }}
                transition={{ delay: 10 }}
                style={{ x }}
            />
        )

        const { rerender } = render(<Component target={0} />)
        rerender(<Component target={0} />)
        await frames()

        rerender(<Component target={10} />)
        await frames()
        expect(x.get()).toBe(0)
    })

    test("the issue's example: delay applies to the mount animation, not hover end", async () => {
        const scale = motionValue(0)
        const Component = () => (
            <motion.div
                initial={{ scale: 0, transition: { out: { delay: 10 } } }}
                animate={{ scale: 1, transition: { type: false } }}
                whileHover={{ scale: 2, transition: { type: false } }}
                style={{ scale }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)
        await frames()
        expect(scale.get()).toBe(0)

        // Hovering interrupts the delayed mount animation
        pointerEnter(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(2)

        // Returning to animate uses animate's own transition, no delay
        pointerLeave(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1)
    })

    test("out: true reuses whileHover's transition when hover ends", async () => {
        const opacity = motionValue(0.5)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ opacity: 0.5, transition: { delay: 10 } }}
                whileHover={{
                    opacity: 1,
                    transition: { type: false, out: true },
                }}
                style={{ opacity }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)

        pointerLeave(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(0.5)
    })

    test("without out, the state being entered defines the transition (unchanged)", async () => {
        const opacity = motionValue(0.5)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ opacity: 0.5, transition: { delay: 10 } }}
                whileHover={{ opacity: 1, transition: { type: false } }}
                style={{ opacity }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)

        pointerLeave(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)
    })

    test("out can be a separate transition for leaving", async () => {
        const opacity = motionValue(0.5)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 10 }}
                whileHover={{
                    opacity: 1,
                    transition: { type: false, out: { type: false } },
                }}
                style={{ opacity }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)

        pointerLeave(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(0.5)
    })

    test("applies when no lower state defines the value", async () => {
        const opacity = motionValue(0.5)
        const Component = () => (
            <motion.div
                transition={{ delay: 10 }}
                whileHover={{
                    opacity: 1,
                    transition: { type: false, out: true },
                }}
                style={{ opacity }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)

        pointerLeave(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(0.5)
    })

    test("value-specific transitions inside an out transition", async () => {
        const opacity = motionValue(0.5)
        const x = motionValue(0)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ opacity: 0.5, x: 0 }}
                transition={{ delay: 10 }}
                whileHover={{
                    opacity: 1,
                    x: 10,
                    transition: {
                        type: false,
                        out: { delay: 10, opacity: { type: false } },
                    },
                }}
                style={{ opacity, x }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect([opacity.get(), x.get()]).toEqual([1, 10])

        pointerLeave(container.firstChild as Element)
        await frames()
        expect([opacity.get(), x.get()]).toEqual([0.5, 10])
    })

    test("a higher-priority state entering uses its own transition", async () => {
        const scale = motionValue(1)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ scale: 1 }}
                whileHover={{
                    scale: 1.5,
                    transition: { type: false, out: true },
                }}
                whileTap={{ scale: 0.5, transition: { delay: 10 } }}
                style={{ scale }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1.5)

        // Hover is overridden, not left: whileTap's delay applies
        pointerDown(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1.5)

        // Tap ends: entering whileHover again uses its transition
        pointerUp(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1.5)

        // Hover ends: its out transition is used
        pointerLeave(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1)
    })

    test("whileTap out applies when returning to whileHover", async () => {
        const scale = motionValue(1)
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ scale: 1 }}
                transition={{ delay: 10 }}
                whileHover={{ scale: 1.5 }}
                whileTap={{
                    scale: 0.5,
                    transition: { type: false, out: true },
                }}
                style={{ scale }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        pointerDown(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(0.5)

        pointerUp(container.firstChild as Element)
        await frames()
        expect(scale.get()).toBe(1.5)
    })

    test("works with variants, including variant children", async () => {
        const parentOpacity = motionValue(0.5)
        const childOpacity = motionValue(0.5)
        const variants: Variants = {
            rest: { opacity: 0.5, transition: { delay: 10 } },
            hover: { opacity: 1, transition: { type: false, out: true } },
        }
        const Component = () => (
            <motion.div
                initial={false}
                animate="rest"
                whileHover="hover"
                variants={variants}
                style={{ opacity: parentOpacity }}
            >
                <motion.div
                    variants={variants}
                    style={{ opacity: childOpacity }}
                />
            </motion.div>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect([parentOpacity.get(), childOpacity.get()]).toEqual([1, 1])

        pointerLeave(container.firstChild as Element)
        await frames()
        expect([parentOpacity.get(), childOpacity.get()]).toEqual([0.5, 0.5])
    })

    test("is used once: the next change into animate uses animate's transition", async () => {
        const opacity = motionValue(0.5)
        const Component = ({ target }: { target: number }) => (
            <motion.div
                initial={false}
                animate={{ opacity: target, transition: { delay: 10 } }}
                whileHover={{
                    opacity: 1,
                    transition: { type: false, out: true },
                }}
                style={{ opacity }}
            />
        )

        const { container, rerender } = render(<Component target={0.5} />)
        rerender(<Component target={0.5} />)

        pointerEnter(container.firstChild as Element)
        await frames()
        pointerLeave(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(0.5)

        rerender(<Component target={0} />)
        await frames()
        expect(opacity.get()).toBe(0.5)
    })
    test("setting only out keeps the value's default transition into the state", async () => {
        const x = motionValue(0)
        const values: number[] = []
        x.on("change", (v) => values.push(v))
        const Component = () => (
            <motion.div
                initial={false}
                animate={{ x: 0 }}
                whileHover={{ x: 100, transition: { out: { type: false } } }}
                style={{ x }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames(40)

        // x's default transition is an underdamped spring, which overshoots
        expect(Math.max(...values)).toBeGreaterThan(100)
    })

    test("with a list of labels, the last label that sets out applies to all its values", async () => {
        const opacity = motionValue(0.5)
        const x = motionValue(0)
        const Component = () => (
            <motion.div
                initial={false}
                animate="rest"
                whileHover={["fade", "move"]}
                variants={{
                    rest: { opacity: 0.5, x: 0, transition: { delay: 10 } },
                    fade: {
                        opacity: 1,
                        transition: { type: false, out: true },
                    },
                    move: { x: 10, transition: { type: false } },
                }}
                style={{ opacity, x }}
            />
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect([opacity.get(), x.get()]).toEqual([1, 10])

        /**
         * out is tracked per state, not per value, so x (from "move", which
         * has no out) also leaves with "fade"'s out transition.
         */
        pointerLeave(container.firstChild as Element)
        await frames()
        expect([opacity.get(), x.get()]).toEqual([0.5, 0])
    })

    test("exiting while hovered uses exit's transition, not hover's out", async () => {
        const opacity = motionValue(0.5)
        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={false}
                        animate={{ opacity: 0.5 }}
                        whileHover={{
                            opacity: 1,
                            transition: { type: false, out: true },
                        }}
                        exit={{ opacity: 0, transition: { delay: 10 } }}
                        style={{ opacity }}
                    />
                )}
            </AnimatePresence>
        )

        const { container, rerender } = render(<Component isVisible />)
        rerender(<Component isVisible />)

        pointerEnter(container.firstChild as Element)
        await frames()
        expect(opacity.get()).toBe(1)

        rerender(<Component isVisible={false} />)
        await frames()
        expect(opacity.get()).toBe(1)
    })
})
