jest.mock("react-native", () => require("./mocks").reactNative)
jest.mock("react-native-reanimated", () => require("./mocks").reanimated)

import { act, fireEvent, render } from "@testing-library/react"
import {
    frame,
    JSAnimation,
    motionValue,
    prefersReducedMotion,
    spring,
} from "motion-dom"
import { useContext } from "react"
import { AnimatePresence } from "../../components/AnimatePresence"
import { MotionConfig } from "../../components/MotionConfig"
import { MotionContext } from "../../context/MotionContext"
import { motion } from "../../native"
import { NativeValueAnimation } from "../NativeValueAnimation"
import { sampleTable } from "../player"
import { buildNativeStyle } from "../style"
import { createTable } from "../table"
import { getStyle } from "./mocks"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const translateX = (testID: string) =>
    getStyle(testID).transform?.find((t: any) => "translateX" in t)
        ?.translateX

const createSampler = (options: any) => {
    const sampler = new JSAnimation({ ...options, autoplay: false })
    sampler.stop()
    return sampler
}

describe("createTable", () => {
    test("samples an animation, including its delay, to its end", () => {
        const options = {
            keyframes: [0, 100],
            duration: 100,
            delay: 50,
            ease: "linear",
        }
        const table = createTable(createSampler(options), options as any)!

        expect(table.duration).toBe(150)
        expect(table.loopLength).toBe(0)
        expect(table.samples[0]).toBe(0)
        expect(table.samples[5]).toBe(0)
        expect(table.samples[10]).toBe(50)
        expect(table.samples[table.samples.length - 1]).toBe(100)
    })

    test("samples a spring to rest", () => {
        const options = { keyframes: [0, 100], type: spring, bounce: 0.5 }
        const table = createTable(createSampler(options), options as any)!

        expect(table.samples.some((v) => (v as number) > 100)).toBe(true)
        expect(table.samples[table.samples.length - 1]).toBe(100)
    })

    test("samples two iterations of an infinite animation to loop", () => {
        const options = {
            keyframes: [0, 100],
            duration: 100,
            ease: "linear",
            repeat: Infinity,
            repeatType: "reverse",
        }
        const table = createTable(createSampler(options), options as any)!

        expect(table.loopStart).toBe(0)
        expect(table.loopLength).toBe(200)
        expect(table.samples[10]).toBe(100)
        expect(table.samples[20]).toBe(0)
    })

    test("leaves animations that are too long to JS", () => {
        const options = { keyframes: [0, 100], duration: 60000 }
        expect(createTable(createSampler(options), options as any)).toBe(
            undefined
        )
    })
})

describe("sampleTable", () => {
    const table = { samples: [0, 10, 20], duration: 20, loopStart: 0, loopLength: 0 }

    test("interpolates numbers and finishes at the end", () => {
        expect(sampleTable(table, 5)).toEqual([5, false])
        expect(sampleTable(table, 25)).toEqual([20, true])
    })

    test("steps between other values", () => {
        const colors = { ...table, samples: ["#000", "#888", "#fff"] }
        expect(sampleTable(colors, 4)[0]).toBe("#000")
        expect(sampleTable(colors, 6)[0]).toBe("#888")
    })

    test("loops", () => {
        const loop = { ...table, loopStart: 5, loopLength: 15 }
        expect(sampleTable(loop, 25)).toEqual([10, false])
    })
})

describe("buildNativeStyle", () => {
    test("builds React Native transforms in Motion's order", () => {
        expect(
            buildNativeStyle({
                rotate: 45,
                opacity: 0.5,
                x: 10,
                scale: 2,
                skewX: "10rad",
                z: 5,
            })
        ).toEqual({
            opacity: 0.5,
            transform: [
                { translateX: 10 },
                { scale: 2 },
                { rotate: "45deg" },
                { skewX: "10rad" },
            ],
        })
    })

    test("builds transformOrigin from origin values", () => {
        expect(buildNativeStyle({ originX: 0, originY: "10px" })).toEqual({
            transformOrigin: ["0%", "10px", 0],
        })
    })
})

describe("motion.View", () => {
    test("renders initial values before animating", () => {
        render(
            <motion.View
                testID="box"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ backgroundColor: "red", width: 10 }}
            />
        )

        expect(getStyle("box")).toEqual({
            backgroundColor: "red",
            width: 10,
            opacity: 0,
            transform: [{ translateX: -100 }],
        })
    })

    test("plays animations on the UI thread, not through the motion value", async () => {
        let visualElement: any
        const Probe = () => {
            visualElement = useContext(MotionContext).visualElement
            return null
        }
        const onComplete = jest.fn()

        render(
            <motion.View
                testID="box"
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={{ duration: 0.2, ease: "linear" }}
                onAnimationComplete={onComplete}
            >
                <Probe />
            </motion.View>
        )

        await act(() => wait(100))

        const x = visualElement.getValue("x")
        const rendered = translateX("box")
        expect(rendered).toBeGreaterThan(10)
        expect(rendered).toBeLessThan(90)
        expect(x.getCurrent()).toBe(0)
        /**
         * Reading the value samples the animation.
         */
        expect(Math.abs(x.get() - rendered)).toBeLessThan(20)

        await act(() => wait(200))

        expect(translateX("box")).toBe(100)
        expect(x.getCurrent()).toBe(100)
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("an interrupted animation continues from where the UI thread was", async () => {
        const { rerender } = render(
            <motion.View
                testID="box"
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={{ duration: 0.4, ease: "linear" }}
            />
        )

        await act(() => wait(150))
        const beforeInterrupt = translateX("box")

        rerender(
            <motion.View
                testID="box"
                initial={{ x: 0 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.4, ease: "linear" }}
            />
        )
        await act(() => wait(40))

        const afterInterrupt = translateX("box")
        expect(Math.abs(afterInterrupt - beforeInterrupt)).toBeLessThan(25)
        expect(afterInterrupt).toBeLessThan(beforeInterrupt + 5)
    })

    test("animates values in JS when onUpdate needs every frame", async () => {
        const onUpdate = jest.fn()

        render(
            <motion.View
                testID="box"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
                onUpdate={onUpdate}
            />
        )

        await act(() => wait(250))

        expect(onUpdate.mock.calls.length).toBeGreaterThan(2)
        expect(getStyle("box").opacity).toBe(1)
    })

    test("animates a motion value passed in style in JS", async () => {
        const x = motionValue(0)
        const output: number[] = []
        x.on("change", (v) => output.push(v))

        render(
            <motion.View
                testID="box"
                style={{ x }}
                animate={{ x: 100 }}
                transition={{ duration: 0.1 }}
            />
        )

        await act(() => wait(250))

        expect(output.length).toBeGreaterThan(2)
        expect(translateX("box")).toBe(100)
    })

    test("whileTap animates while touched", async () => {
        const onTap = jest.fn()
        const { getByTestId } = render(
            <motion.View
                testID="box"
                whileTap={{ scale: 0.5 }}
                transition={{ duration: 0.05 }}
                onTap={onTap}
            />
        )

        fireEvent.touchStart(getByTestId("box"))
        await act(() => wait(150))
        expect(getStyle("box").transform).toEqual([{ scale: 0.5 }])

        fireEvent.touchEnd(getByTestId("box"))
        await act(() => wait(150))
        expect(getStyle("box").transform).toEqual([{ scale: 1 }])
        expect(onTap).toHaveBeenCalledTimes(1)
    })

    test("AnimatePresence keeps a view until its exit animation finishes", async () => {
        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence>
                {isVisible && (
                    <motion.View
                        key="box"
                        testID="box"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                    />
                )}
            </AnimatePresence>
        )

        const { rerender, queryByTestId } = render(<Component isVisible />)
        rerender(<Component isVisible={false} />)

        await act(() => wait(50))
        expect(queryByTestId("box")).not.toBe(null)

        await act(() => wait(250))
        expect(queryByTestId("box")).toBe(null)
    })

    test("variants propagate to children", async () => {
        render(
            <motion.View
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: {} }}
            >
                <motion.View
                    testID="child"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1 },
                    }}
                    transition={{ duration: 0.05 }}
                />
            </motion.View>
        )

        expect(getStyle("child").opacity).toBe(0)
        await act(() => wait(200))
        expect(getStyle("child").opacity).toBe(1)
    })
})

describe("NativeValueAnimation", () => {
    /**
     * A UI thread that never gets back to JS, as when JS is busy.
     */
    const silentHost = () => ({
        write() {},
        remove() {},
        play: () => () => {},
    })

    const createAnimation = (options: any) =>
        NativeValueAnimation.create(
            {
                name: "x",
                keyframes: [0, 100],
                duration: 0.1,
                ease: "linear",
                ...options,
            },
            silentHost()
        )!

    test("stopping after the UI thread has finished completes the animation", async () => {
        const onComplete = jest.fn()
        const onStop = jest.fn()
        const animation = createAnimation({ onComplete, onStop })

        await wait(150)
        animation.stop()

        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onStop).not.toHaveBeenCalled()
        expect(animation.state).toBe("finished")
    })

    test("a value set in the frame the animation stops keeps that value", async () => {
        const value = motionValue(0)
        const animation = createAnimation({ motionValue: value, duration: 1 })

        await wait(100)
        frame.postRender(() => {})
        value.set(500)
        animation.stop()

        expect(value.get()).toBe(500)
    })
})

describe("motion.View lifecycle", () => {
    test("a value removed from style is removed from the view", async () => {
        const Component = ({ on }: { on: boolean }) => (
            <motion.View testID="box" style={on ? { scale: 2 } : {}} />
        )
        const { rerender } = render(<Component on />)
        await act(() => wait(50))
        expect(getStyle("box").transform).toEqual([{ scale: 2 }])

        rerender(<Component on={false} />)
        await act(() => wait(50))
        expect(getStyle("box").transform).toBe(undefined)
    })

    test("runs the cleanup a callback ref returns", () => {
        const cleanup = jest.fn()
        const ref = jest.fn(() => cleanup)
        const { unmount } = render(<motion.View testID="box" ref={ref} />)

        unmount()
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(ref).toHaveBeenCalledTimes(1)
    })

    test("a tap that ends outside the view is cancelled", async () => {
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const { getByTestId } = render(
            <motion.View testID="box" onTap={onTap} onTapCancel={onTapCancel} />
        )
        const box = getByTestId("box")

        fireEvent.touchStart(box)
        fireEvent(
            box,
            Object.assign(new Event("touchend", { bubbles: true }), {
                locationX: 150,
            })
        )

        expect(onTap).not.toHaveBeenCalled()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
    })

    test("whileTap stays active until the last finger lifts", async () => {
        const { getByTestId } = render(
            <motion.View
                testID="box"
                whileTap={{ scale: 0.5 }}
                transition={{ duration: 0.05 }}
            />
        )
        const box = getByTestId("box")

        fireEvent.touchStart(box)
        fireEvent(
            box,
            Object.assign(new Event("touchend", { bubbles: true }), {
                fingers: [{}],
            })
        )
        await act(() => wait(150))
        expect(getStyle("box").transform).toEqual([{ scale: 0.5 }])
    })

    test("follows the device's reduce motion setting once it's known", async () => {
        prefersReducedMotion.current = null
        const Component = ({ x }: { x: number }) => (
            <MotionConfig reducedMotion="user">
                <motion.View
                    testID="box"
                    animate={{ x }}
                    transition={{ duration: 1, ease: "linear" }}
                />
            </MotionConfig>
        )
        const { rerender } = render(<Component x={0} />)
        await act(() => wait(20))

        prefersReducedMotion.current = true
        rerender(<Component x={100} />)
        await act(() => wait(50))
        expect(translateX("box")).toBe(100)

        prefersReducedMotion.current = false
    })
})
