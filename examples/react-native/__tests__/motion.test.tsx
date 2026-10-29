import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { getAnimatedStyle } from "react-native-reanimated"
import { AnimatePresence, motion } from "motion/react-native"

/**
 * motion/react-native against the real React Native and Reanimated, in
 * Reanimated's Jest mode: worklets run on the JS thread and fake timers
 * drive frames.
 */

const linear = { duration: 1, ease: "linear" } as const

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
})

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))

/**
 * Typed from Reanimated's web entry, which takes no arguments.
 */
const style = (testID: string): { [key: string]: any } =>
    (getAnimatedStyle as Function)(screen.getByTestId(testID))

const transform = (testID: string) =>
    Object.assign({}, ...(style(testID).transform ?? []))

test("animates from initial to animate", async () => {
    await render(
        <motion.View
            testID="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={linear}
        />
    )
    expect(style("box").opacity).toBe(0)

    await advance(500)
    expect(style("box").opacity).toBeCloseTo(0.5, 1)

    await advance(600)
    expect(style("box").opacity).toBe(1)
})

test("builds a transform in Motion's order", async () => {
    await render(
        <motion.View
            testID="box"
            initial={{ x: 0, rotate: 0, scale: 1 }}
            animate={{ x: 100, rotate: 90, scale: 2 }}
            transition={linear}
        />
    )
    await advance(500)
    const { transform: list } = style("box")
    expect(list.map((t: object) => Object.keys(t)[0])).toEqual([
        "translateX",
        "scale",
        "rotate",
    ])
    expect(transform("box").translateX).toBeCloseTo(50, -1)

    await advance(600)
    expect(transform("box")).toEqual({ translateX: 100, scale: 2, rotate: "90deg" })
})

test("interrupting continues from the current value", async () => {
    const Box = ({ x }: { x: number }) => (
        <motion.View testID="box" initial={{ x: 0 }} animate={{ x }} transition={linear} />
    )
    const { rerender } = await render(<Box x={100} />)
    await advance(500)
    const before = transform("box").translateX
    expect(before).toBeCloseTo(50, -1)

    await rerender(<Box x={0} />)
    await advance(20)
    expect(Math.abs(transform("box").translateX - before)).toBeLessThan(5)

    await advance(1100)
    expect(transform("box").translateX).toBe(0)
})

test("springs settle on their target", async () => {
    await render(
        <motion.View
            testID="box"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.4 }}
        />
    )
    await advance(200)
    expect(transform("box").scale).toBeGreaterThan(0.5)
    await advance(3000)
    expect(transform("box").scale).toBe(1)
})

test("repeat: Infinity loops", async () => {
    await render(
        <motion.View
            testID="box"
            animate={{ rotate: 360 }}
            transition={{ ...linear, repeat: Infinity }}
        />
    )
    await advance(250)
    const first = parseFloat(transform("box").rotate)
    expect(first).toBeCloseTo(90, -1)

    await advance(1000)
    expect(parseFloat(transform("box").rotate)).toBeCloseTo(first, -1)
})

test("whileTap animates while touched", async () => {
    await render(
        <motion.View testID="box" whileTap={{ scale: 0.8 }} transition={{ duration: 0.2 }} />
    )
    await fireEvent(screen.getByTestId("box"), "touchStart", { nativeEvent: {} })
    await advance(400)
    expect(transform("box").scale).toBe(0.8)

    await fireEvent(screen.getByTestId("box"), "touchEnd", { nativeEvent: {} })
    await advance(400)
    expect(transform("box").scale).toBe(1)
})

test("variants propagate to children", async () => {
    await render(
        <motion.View initial="hidden" animate="visible" variants={{ hidden: {}, visible: {} }}>
            <motion.View
                testID="child"
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                transition={linear}
            />
        </motion.View>
    )
    expect(style("child").opacity).toBe(0)
    await advance(1100)
    expect(style("child").opacity).toBe(1)
})

test("AnimatePresence animates exit, then removes", async () => {
    const List = ({ show }: { show: boolean }) => (
        <AnimatePresence>
            {show && (
                <motion.View
                    key="box"
                    testID="box"
                    exit={{ opacity: 0 }}
                    transition={linear}
                />
            )}
        </AnimatePresence>
    )
    const { rerender } = await render(<List show />)
    await rerender(<List show={false} />)
    await advance(500)
    expect(style("box").opacity).toBeCloseTo(0.5, 1)

    await advance(600)
    expect(screen.queryByTestId("box")).toBeNull()
})

test("onUpdate is called every frame", async () => {
    const onUpdate = jest.fn()
    await render(
        <motion.View
            testID="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={linear}
            onUpdate={onUpdate}
        />
    )
    await advance(500)
    expect(onUpdate.mock.calls.length).toBeGreaterThan(10)
    expect(style("box").opacity).toBeCloseTo(0.5, 1)
})
