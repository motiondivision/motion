import { supportsFlags } from "motion-dom"
import { act, createRef, useState } from "react"
import { motion, spring, useMotionValue } from "../../"
import {
    pointerDown,
    pointerEnter,
    pointerLeave,
    pointerUp,
    render,
} from "../../../jest.setup"
import "../../animation/animators/waapi/__tests__/setup"
import { nextFrame } from "../../gestures/__tests__/utils"

describe("WAAPI animations", () => {
    test("opacity animates with WAAPI at default settings", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                delay: -0,
                duration: 300,
                easing: "cubic-bezier(0.25, 0.1, 0.35, 1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    test("filter animates with WAAPI at default settings", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ filter: "brightness(0%)" }}
                animate={{ filter: "brightness(50%)" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                filter: ["brightness(0%)", "brightness(50%)"],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 300,
                easing: "cubic-bezier(0.25, 0.1, 0.35, 1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    test("clipPath animates with WAAPI at default settings", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ clipPath: "inset(100%)" }}
                animate={{ clipPath: "inset(0%)" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                clipPath: ["inset(100%)", "inset(0%)"],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 300,
                easing: "cubic-bezier(0.25, 0.1, 0.35, 1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    test("Complex string type animates with WAAPI spring", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ clipPath: "inset(100%)" }}
                animate={{ clipPath: "inset(0%)" }}
                transition={{ type: "spring" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                clipPath: clipPathSpring,
                offset: undefined,
            },
            {
                delay: -0,
                duration: 1060,
                easing: "linear",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    test("transform animates with WAAPI at default settings", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ transform: "translateX(0px)" }}
                animate={{ transform: "translateX(100px)" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                transform: ["translateX(0px)", "translateX(100px)"],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 300,
                easing: "cubic-bezier(0.25, 0.1, 0.35, 1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    // backgroundColor currently disabled for performance reasons
    test.skip("backgroundColor animates with WAAPI at default settings", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ backgroundColor: "#f00" }}
                animate={{ backgroundColor: "#00f" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                backgroundColor: [
                    "rgba(255, 0, 0, 1)",
                    "rgba(253, 0, 35, 1)",
                    "rgba(249, 0, 56, 1)",
                    "rgba(244, 0, 75, 1)",
                    "rgba(237, 0, 94, 1)",
                    "rgba(229, 0, 112, 1)",
                    "rgba(220, 0, 128, 1)",
                    "rgba(211, 0, 144, 1)",
                    "rgba(200, 0, 158, 1)",
                    "rgba(190, 0, 171, 1)",
                    "rgba(179, 0, 182, 1)",
                    "rgba(168, 0, 192, 1)",
                    "rgba(157, 0, 201, 1)",
                    "rgba(147, 0, 209, 1)",
                    "rgba(136, 0, 215, 1)",
                    "rgba(126, 0, 222, 1)",
                    "rgba(116, 0, 227, 1)",
                    "rgba(107, 0, 232, 1)",
                    "rgba(97, 0, 236, 1)",
                    "rgba(88, 0, 239, 1)",
                    "rgba(79, 0, 242, 1)",
                    "rgba(71, 0, 245, 1)",
                    "rgba(62, 0, 247, 1)",
                    "rgba(54, 0, 249, 1)",
                    "rgba(46, 0, 251, 1)",
                    "rgba(38, 0, 252, 1)",
                    "rgba(30, 0, 253, 1)",
                    "rgba(22, 0, 254, 1)",
                    "rgba(15, 0, 255, 1)",
                    "rgba(7, 0, 255, 1)",
                    "rgba(0, 0, 255, 1)",
                ],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 300,
                easing: "linear",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
    })

    test("opacity animates with WAAPI when no value is originally provided via initial", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                animate={{ opacity: 1 }}
                style={{ opacity: 0 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
    })

    test("opacity animates with WAAPI at default settings with no initial value set", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                animate={{ opacity: 1 }}
                style={{ opacity: 0 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
    })

    test("opacity animates with WAAPI at default settings when layout is enabled", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                animate={{ opacity: 1 }}
                style={{ opacity: 0 }}
                layout
                layoutId="a"
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
    })

    test("WAAPI only receives expected number of calls in Framer configuration with hover gestures enabled", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => {
            const [isHovered, setIsHovered] = useState(false)

            return (
                <motion.div
                    initial="none"
                    animate={isHovered ? "hover" : "none"}
                    onHoverStart={() => act(() => setIsHovered(true))}
                    onHoverEnd={() => act(() => setIsHovered(false))}
                >
                    <motion.div
                        ref={ref}
                        style={{ opacity: 0.5 }}
                        variants={{ hover: { opacity: 1 } }}
                        transition={{ duration: 0.001 }}
                    />
                </motion.div>
            )
        }
        const { container, rerender } = render(<Component />)
        pointerEnter(container.firstChild as Element)

        await nextFrame()
        await nextFrame()
        pointerLeave(container.firstChild as Element)
        await nextFrame()
        await nextFrame()
        rerender(<Component />)
        await nextFrame()
        await nextFrame()

        expect(ref.current!.animate).toBeCalledTimes(2)
    })

    test("WAAPI only receives expected number of calls in Framer configuration with tap gestures enabled", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => {
            const [isPressed, setIsPressed] = useState(false)

            return (
                <motion.div
                    initial="none"
                    animate={isPressed ? "press" : "none"}
                    onTapStart={() => setIsPressed(true)}
                    onTap={() => setIsPressed(false)}
                >
                    <motion.div
                        ref={ref}
                        style={{ opacity: 0.5 }}
                        variants={{ press: { opacity: 1 } }}
                    />
                </motion.div>
            )
        }
        const { container, rerender } = render(<Component />)
        pointerDown(container.firstChild as Element)

        await nextFrame()
        await nextFrame()
        pointerUp(container.firstChild as Element)

        await nextFrame()

        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalledTimes(2)
    })

    test("WAAPI is called with expected arguments", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    repeat: 3,
                    repeatType: "reverse",
                    duration: 1,
                    delay: 2,
                    ease: [0, 0.2, 0.7, 1],
                    times: [0.2, 0.9],
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: [0.2, 0.9] },
            {
                delay: 2000,
                duration: 1000,
                easing: "cubic-bezier(0, 0.2, 0.7, 1)",
                iterations: 4,
                direction: "alternate",
                fill: "both",
            }
        )
    })

    test("WAAPI is called with pre-generated keyframes when linear() is unsupported ", async () => {
        supportsFlags.linearEasing = false
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    duration: 0.05,
                    delay: 2,
                    ease: (p) => p,
                    times: [0, 1],
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [0, 0.2, 0.4, 0.6, 0.8, 1],
                offset: undefined,
            },
            {
                delay: 2000,
                duration: 50,
                direction: "normal",
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("WAAPI is called with generated linear() easing function when supported", async () => {
        supportsFlags.linearEasing = true
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    duration: 0.05,
                    delay: 2,
                    ease: (p) => p,
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                delay: 2000,
                duration: 50,
                direction: "normal",
                easing: "linear(0, 0.25, 0.5, 0.75, 1)",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Maps 'easeIn' to 'ease-in'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "easeIn",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "ease-in",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'easeOut' to 'ease-out'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "easeOut",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "ease-out",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'easeInOut' to 'ease-in-out'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "easeInOut",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "ease-in-out",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'circIn' to 'cubic-bezier(0, 0.65, 0.55, 1)'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "circIn",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "cubic-bezier(0, 0.65, 0.55, 1)",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'circOut' to 'cubic-bezier(0.55, 0, 1, 0.45)'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "circOut",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "cubic-bezier(0.55, 0, 1, 0.45)",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'backIn' to 'cubic-bezier(0.31, 0.01, 0.66, -0.59)'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "backIn",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()
        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "cubic-bezier(0.31, 0.01, 0.66, -0.59)",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("Maps 'backOut' to 'cubic-bezier(0.33, 1.53, 0.69, 0.99)'", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    ease: "backOut",
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            { opacity: [0, 1], offset: undefined },
            {
                easing: "cubic-bezier(0.33, 1.53, 0.69, 0.99)",
                delay: -0,
                duration: 300,
                direction: "normal",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("WAAPI is called with pre-generated spring keyframes", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    type: "spring",
                    duration: 0.1,
                    bounce: 0,
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, 0.23606867982504365, 0.5509083741195555,
                    0.7637684153125726, 0.8831910398786699, 0.9444771835619267,
                    0.9743215604668359, 0.9883608373299467, 0.9948051108537942,
                    0.9977094774280534, 1,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 100,
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )
    })

    test("WAAPI is called with pre-generated generator keyframes", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                    type: spring,
                    duration: 0.1,
                    bounce: 0,
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, 0.23606867982504365, 0.5509083741195555,
                    0.7637684153125726, 0.8831910398786699, 0.9444771835619267,
                    0.9743215604668359, 0.9883608373299467, 0.9948051108537942,
                    0.9977094774280534, 1,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 100,
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )
    })

    /**
     * TODO: We could not accelerate but scrub WAAPI animation if repeatDelay is defined
     */
    test("Doesn't animate with WAAPI if repeatDelay is defined", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ repeatDelay: 1 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).not.toBeCalled()
    })

    test("Pregenerates keyframes if ease is anticipate and linear() is not supported", async () => {
        supportsFlags.linearEasing = false
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ ease: "anticipate", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, -0.038019759996313955, 0.14036703066311026, 0.7875,
                    0.89296875, 0.899560546875,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )

        supportsFlags.linearEasing = undefined
    })

    test("Generates linear() easing if ease is anticipate", async () => {
        supportsFlags.linearEasing = true
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ ease: "anticipate", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [0, 0.9],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear(0, -0.033628590829175686, 0.5, 0.984375, 0.99951171875)",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Pregenerates keyframes if ease is backInOut and linear() is not supported", async () => {
        supportsFlags.linearEasing = false

        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ ease: "backInOut", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, -0.038019759996313955, 0.14036703066311026,
                    0.7596329693368897, 0.9380197599963139, 0.9,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Generates linear() if ease is backInOut", async () => {
        supportsFlags.linearEasing = true

        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ ease: "backInOut", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [0, 0.7],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear(0, -0.033628590829175686, 0.5, 1.0336285908291756, 1)",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Pregenerates keyframes if ease is circInOut and linear() is not supported", async () => {
        supportsFlags.linearEasing = false
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ ease: "circInOut", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, 0.03756818745397441, 0.18000000000000008, 0.72,
                    0.8624318125460256, 0.9,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Generates linear() if ease is circInOut", async () => {
        supportsFlags.linearEasing = true
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ ease: "circInOut", duration: 0.05 }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [0, 0.9],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear(0, 0.06698729810778065, 0.5, 0.9330127018922194, 1)",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Doesn't animate with WAAPI if repeatType is defined as mirror", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ repeatType: "mirror" }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()
        expect(ref.current!.animate).not.toBeCalled()
    })

    test("Doesn't animate with WAAPI if onUpdate is defined", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onUpdate={() => {}}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).not.toBeCalled()
    })

    test("Doesn't animate with WAAPI if external motion value is defined", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                style={{ opacity: useMotionValue(0) }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).not.toBeCalled()
    })

    test("Animates with WAAPI if repeat is defined and we need to generate keyframes", async () => {
        supportsFlags.linearEasing = false
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{
                    ease: "backInOut",
                    duration: 0.05,
                    repeat: 2,
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, -0.038019759996313955, 0.14036703066311026,
                    0.7596329693368897, 0.9380197599963139, 0.9,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear",
                fill: "both",
                iterations: 3,
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Animates with WAAPI if repeat is Infinity and we need to generate keyframes", async () => {
        supportsFlags.linearEasing = false
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{
                    ease: "backInOut",
                    duration: 0.05,
                    repeat: Infinity,
                }}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
        expect(ref.current!.animate).toBeCalledWith(
            {
                opacity: [
                    0, -0.038019759996313955, 0.14036703066311026,
                    0.7596329693368897, 0.9380197599963139, 0.9,
                ],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                easing: "linear",
                fill: "both",
                iterations: Infinity,
            }
        )
        supportsFlags.linearEasing = undefined
    })
})

const clipPathSpring = [
    "inset(100%)",
    "inset(99.51666%)",
    "inset(98.13308%)",
    "inset(95.94808%)",
    "inset(93.0587%)",
    "inset(89.55945%)",
    "inset(85.54164%)",
    "inset(81.09282%)",
    "inset(76.2963%)",
    "inset(71.23077%)",
    "inset(65.97002%)",
    "inset(60.58262%)",
    "inset(55.13186%)",
    "inset(49.6756%)",
    "inset(44.26624%)",
    "inset(38.95075%)",
    "inset(33.77073%)",
    "inset(28.76256%)",
    "inset(23.9575%)",
    "inset(19.3819%)",
    "inset(15.05744%)",
    "inset(11.00133%)",
    "inset(7.22661%)",
    "inset(3.74239%)",
    "inset(0.55415%)",
    "inset(-2.33596%)",
    "inset(-4.92882%)",
    "inset(-7.22808%)",
    "inset(-9.23981%)",
    "inset(-10.97224%)",
    "inset(-12.43548%)",
    "inset(-13.64123%)",
    "inset(-14.60254%)",
    "inset(-15.33352%)",
    "inset(-15.84914%)",
    "inset(-16.16499%)",
    "inset(-16.29709%)",
    "inset(-16.26165%)",
    "inset(-16.07497%)",
    "inset(-15.75321%)",
    "inset(-15.31228%)",
    "inset(-14.76771%)",
    "inset(-14.13455%)",
    "inset(-13.42725%)",
    "inset(-12.65959%)",
    "inset(-11.84461%)",
    "inset(-10.99456%)",
    "inset(-10.12086%)",
    "inset(-9.23407%)",
    "inset(-8.34388%)",
    "inset(-7.45906%)",
    "inset(-6.58752%)",
    "inset(-5.73628%)",
    "inset(-4.9115%)",
    "inset(-4.11851%)",
    "inset(-3.36183%)",
    "inset(-2.64518%)",
    "inset(-1.97159%)",
    "inset(-1.34334%)",
    "inset(-0.76211%)",
    "inset(-0.22895%)",
    "inset(0.25566%)",
    "inset(0.69171%)",
    "inset(1.0797%)",
    "inset(1.42049%)",
    "inset(1.71535%)",
    "inset(1.96584%)",
    "inset(2.1738%)",
    "inset(2.3413%)",
    "inset(2.4706%)",
    "inset(2.5641%)",
    "inset(2.62433%)",
    "inset(2.65387%)",
    "inset(2.65537%)",
    "inset(2.63147%)",
    "inset(2.58483%)",
    "inset(2.51805%)",
    "inset(2.43368%)",
    "inset(2.3342%)",
    "inset(2.22199%)",
    "inset(2.09934%)",
    "inset(1.96839%)",
    "inset(1.83119%)",
    "inset(1.68964%)",
    "inset(1.54548%)",
    "inset(1.40036%)",
    "inset(1.25572%)",
    "inset(1.11292%)",
    "inset(0.97312%)",
    "inset(0.83737%)",
    "inset(0.70657%)",
    "inset(0.58151%)",
    "inset(0.46282%)",
    "inset(0.35102%)",
    "inset(0.24652%)",
    "inset(0.14963%)",
    "inset(0.06053%)",
    "inset(-0.02067%)",
    "inset(-0.09394%)",
    "inset(-0.15935%)",
    "inset(-0.21701%)",
    "inset(-0.26713%)",
    "inset(-0.30993%)",
    "inset(-0.34572%)",
    "inset(-0.37481%)",
    "inset(-0.39757%)",
    "inset(0%)",
]
