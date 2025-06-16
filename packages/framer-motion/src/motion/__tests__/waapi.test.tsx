import { supportsFlags } from "motion-dom"
import { act, createRef, useState } from "react"
import { motion, useMotionValue } from "../../"
import "../../animation/animators/waapi/__tests__/setup"
import { nextFrame } from "../../gestures/__tests__/utils"
import {
    pointerDown,
    pointerEnter,
    pointerLeave,
    pointerUp,
    render,
} from "../../jest.setup"

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

    test("Spring generates linear() easing", async () => {
        supportsFlags.linearEasing = true
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
                clipPath: ["inset(100%)", "inset(0%)"],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 1100,
                easing: "linear(0, 0.0049, 0.019, 0.0412, 0.0706, 0.1061, 0.1469, 0.1921, 0.2407, 0.292, 0.3452, 0.3997, 0.4547, 0.5097, 0.5642, 0.6177, 0.6698, 0.72, 0.7681, 0.8139, 0.8571, 0.8975, 0.935, 0.9696, 1.0011, 1.0296, 1.055, 1.0775, 1.0971, 1.1139, 1.1279, 1.1394, 1.1484, 1.1551, 1.1597, 1.1623, 1.163, 1.1621, 1.1598, 1.1561, 1.1512, 1.1454, 1.1387, 1.1313, 1.1234, 1.115, 1.1063, 1.0974, 1.0884, 1.0794, 1.0706, 1.0619, 1.0534, 1.0452, 1.0374, 1.03, 1.0229, 1.0164, 1.0103, 1.0047, 0.9996, 0.9949, 0.9908, 0.9872, 0.984, 0.9813, 0.979, 0.9772, 0.9757, 0.9747, 0.9739, 0.9735, 0.9734, 0.9736, 0.974, 0.9746, 0.9754, 0.9764, 0.9774, 0.9787, 0.98, 0.9813, 0.9827, 0.9842, 0.9857, 0.9871, 0.9886, 0.99, 0.9914, 0.9927, 0.994, 0.9952, 0.9963, 0.9974, 0.9984, 0.9993, 1.0001, 1.0009, 1.0015, 1.0021, 1.0026, 1.0031, 1.0034, 1.0037, 1.004, 1, 1, 1, 1, 1)",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
        supportsFlags.linearEasing = undefined
    })

    test("Spring generates easeOut easing if linear() not supported", async () => {
        supportsFlags.linearEasing = false
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
                clipPath: ["inset(100%)", "inset(0%)"],
                offset: undefined,
            },
            {
                delay: -0,
                duration: 300,
                easing: "ease-out",
                iterations: 1,
                direction: "normal",
                fill: "both",
            }
        )
        supportsFlags.linearEasing = undefined
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

    test.skip("WAAPI only receives expected number of calls in Framer configuration with hover gestures enabled", async () => {
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

    test.skip("WAAPI only receives expected number of calls in Framer configuration with tap gestures enabled", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => {
            const [isPressed, setIsPressed] = useState(false)

            return (
                <motion.div
                    initial="none"
                    animate={isPressed ? "press" : "none"}
                    onTapStart={() => act(() => setIsPressed(true))}
                    onTap={() => act(() => setIsPressed(false))}
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

    test("WAAPI is called with easeOut easing if linear() not supported", async () => {
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
                opacity: [0, 1],
                offset: [0, 1],
            },
            {
                delay: 2000,
                duration: 50,
                direction: "normal",
                easing: "ease-out",
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

    test("WAAPI is called with linear() easing if ease is spring", async () => {
        supportsFlags.linearEasing = true
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
                opacity: [0, 1],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 100,
                easing: "linear(0, 0.2738, 0.6079, 0.8122, 0.9157, 0.9637, 0.9848, 0.9938, 0.9975, 1)",
                fill: "both",
                iterations: 1,
            }
        )
        supportsFlags.linearEasing = undefined
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
                easing: "linear(0, -0.0336, 0.5, 0.9844, 0.9995)",
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
                easing: "linear(0, -0.0336, 0.5, 1.0336, 1)",
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
                easing: "linear(0, 0.067, 0.5, 0.933, 1)",
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

    test("Doesn't animate transform values with WAAPI if transformTemplate is defined", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ transform: "translate(0px)" }}
                animate={{ transform: "translate(100px)" }}
                transformTemplate={(_, t) => t}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).not.toBeCalled()
    })

    test("Does animate non-transform values with WAAPI even if transformTemplate is defined", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transformTemplate={(_, t) => t}
            />
        )
        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(ref.current!.animate).toBeCalled()
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
                opacity: [0, 0.9],
                offset: undefined,
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                fill: "both",
                iterations: 3,
                easing: "ease-out",
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
                opacity: [0, 0.9],
            },
            {
                delay: -0,
                direction: "normal",
                duration: 50,
                fill: "both",
                iterations: Infinity,
                easing: "ease-out",
            }
        )
        supportsFlags.linearEasing = undefined
    })
})
