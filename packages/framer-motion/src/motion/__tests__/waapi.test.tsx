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
                easing: "linear(0, 0.00492095368383275, 0.019000984981739463, 0.041224610943463774, 0.07059500467226315, 0.10614185285590878, 0.14692820240784954, 0.19205632698700284, 0.24067265069778515, 0.29197177181694345, 0.3451996339917363, 0.3996558960513803, 0.4546955544211474, 0.5097298741800398, 0.5642266861151756, 0.6177101077571204, 0.6697597463896967, 0.7200094414748801, 0.7681456028775725, 0.8139051997748197, 0.8570734532466008, 0.8974812833260857, 0.9350025587895763, 0.9695511952411193, 1.00107814414221, 1.029568312398454, 1.0550374489847534, 1.0775290319076793, 1.097111185604009, 1.113873655690537, 1.127924864841526, 1.1393890705025682, 1.1484036421760593, 1.1551164731537122, 1.159683538842269, 1.1622666112437607, 1.1630311367224075, 1.162144281925159, 1.1597731506281155, 1.15608317236054, 1.1512366619137777, 1.1453915472740652, 1.1387002621242792, 1.1313087978368275, 1.1233559088236016, 1.1149724642133656, 1.1062809380854448, 1.097395029893436, 1.0884194062556494, 1.0794495549612384, 1.0705717418332577, 1.0618630609927004, 1.0533915690712283, 1.0452164940151056, 1.0373885092991255, 1.0299500646175324, 1.0229357644297976, 1.0163727861035714, 1.0102813298065505, 1.0046750927450665, 0.9995617608221014, 0.994943511283805, 0.9908175204345401, 0.9871764710197052, 0.984009054397223, 0.981300463137384, 0.9790328702019366, 0.9771858913526992, 0.9757370279238401, 0.9746620875571338, 0.9739355809432482, 0.9735310930322081, 0.9734216275708206, 0.9735799241926674, 0.97397874762626, 0.9745911488985395, 0.9753906986937353, 0.9763516932817611, 0.9774493336560588, 0.978659878718694, 0.9799607735212718, 0.9813307537148701, 0.9827499274817646, 0.9841998363174931, 0.9856634961051535, 0.9871254199761655, 0.9885716244845871, 0.9899896206369913, 0.9913683913184798, 0.9926983566391931, 0.9939713286962706, 0.9951804572051599, 0.9963201674029861, 0.9973860915668434, 0.9983749954227661, 0.9992847006481276, 1.000114004592579, 1.0008625982615447, 1.001530983522911, 1.0021203904128289, 1.0026326953315294, 1.0030703408354977, 1.0034362576491143, 1.0037337894375618, 1.0039666208040663, 1, 1, 1, 1, 1)",
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
                easing: "linear(0, 0.2737809528917775, 0.6078517237120086, 0.8121752183487257, 0.9157330759705354, 0.9637215929231747, 0.9848190277625796, 0.9937779942213871, 0.9974899750750417, 1)",
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
                easing: "linear(0, -0.033628590829175686, 0.5, 0.984375, 0.99951171875)",
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
