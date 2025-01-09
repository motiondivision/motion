import { createRef, useRef } from "react"
import {
    frame,
    motion,
    motionValue,
    useMotionValue,
    useMotionValueEvent,
} from "../../"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

describe("animate prop as object", () => {
    test("animates to set prop", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })
    test("accepts custom transition prop", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    transition={{
                        x: { type: "tween", from: 10, ease: () => 0.5 },
                    }}
                    onUpdate={() => resolve(x.get())}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(15)
    })
    test("fires onAnimationStart when animation begins", async () => {
        const promise = new Promise((resolve) => {
            const onStart = jest.fn()
            const onComplete = () => resolve(onStart)
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
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
    test("uses transition on subsequent renders", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const Component = ({ animate }: any) => (
                <motion.div animate={animate} style={{ x }} />
            )
            const { rerender } = render(
                <Component animate={{ x: 10, transition: { type: false } }} />
            )
            rerender(
                <Component animate={{ x: 20, transition: { type: false } }} />
            )
            rerender(
                <Component animate={{ x: 30, transition: { type: false } }} />
            )
            requestAnimationFrame(() => resolve(x.get()))
        })
        return expect(promise).resolves.toBe(30)
    })
    test("transition accepts manual from value", async () => {
        const promise = new Promise((resolve) => {
            const output: number[] = []
            const Component = () => (
                <motion.div
                    initial={{ x: 100 }}
                    animate={{ x: 50 }}
                    transition={{ from: 0, ease: "linear" }}
                    onUpdate={(v: { x: number }) => output.push(v.x)}
                    onAnimationComplete={() => {
                        resolve(output.every((v) => v <= 50))
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(true)
    })
    test("uses transitionEnd on subsequent renders", async () => {
        const promise = new Promise(async (resolve) => {
            const x = motionValue(0)
            const Component = ({ animate }: any) => (
                <motion.div animate={animate} style={{ x }} />
            )
            const { rerender } = render(
                <Component
                    animate={{
                        x: 10,
                        transition: { type: false },
                        transitionEnd: { x: 100 },
                    }}
                />
            )
            rerender(
                <Component
                    animate={{
                        x: 20,
                        transition: { type: false },
                        transitionEnd: { x: 200 },
                    }}
                />
            )
            rerender(
                <Component
                    animate={{
                        x: 30,
                        transition: { type: false },
                        transitionEnd: { x: 300 },
                    }}
                />
            )

            await nextFrame()
            await nextFrame()

            resolve(x.get())
        })
        return expect(promise).resolves.toBe(300)
    })
    test("animates to set prop and preserves existing initial transform props", async () => {
        const promise = new Promise((resolve) => {
            const onComplete = () => {
                // Animation complete currently fires when animation is complete, before the actual render
                setTimeout(() => resolve(container.firstChild as any), 20)
            }
            const { container, rerender } = render(
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ x: 20 }}
                    onAnimationComplete={onComplete}
                />
            )
            rerender(
                <motion.div
                    animate={{ x: 20 }}
                    onAnimationComplete={onComplete}
                />
            )
        })
        return expect(promise).resolves.toHaveStyle(
            "transform: translateX(20px) scale(0)"
        )
    })
    test("style doesnt overwrite in subsequent renders", async () => {
        const promise = new Promise((resolve) => {
            const history: number[] = []
            const onAnimationComplete = () => {
                setTimeout(() => {
                    let styleHasOverridden = false
                    let prev = 0
                    for (let i = 0; i < history.length; i++) {
                        if (history[i] < prev) {
                            styleHasOverridden = true
                            break
                        }
                        prev = history[i]
                    }
                    resolve(styleHasOverridden)
                }, 20)
            }
            const Component = ({ rotate, onComplete }: any) => (
                <motion.div
                    animate={{ rotate: `${rotate}deg` }}
                    transition={{ duration: 0.05 }}
                    style={{ rotate: "0deg" }}
                    onUpdate={({ rotate }) =>
                        history.push(parseFloat(rotate as string))
                    }
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component rotate={1000} />)
            rerender(<Component rotate={1000} />)
            setTimeout(() => {
                rerender(
                    <Component rotate={1001} onComplete={onAnimationComplete} />
                )
            }, 120)
        })
        return expect(promise).resolves.toBe(false)
    })
    test("applies custom transform", async () => {
        const promise = new Promise((resolve) => {
            const resolveContainer = () => {
                requestAnimationFrame(() => {
                    resolve(container.firstChild as any)
                })
            }
            const Component = () => (
                <motion.div
                    initial={{ x: 10 }}
                    animate={{ x: 30 }}
                    transition={{ duration: 0.01 }}
                    transformTemplate={({ x }, generated) =>
                        `translateY(${x}) ${generated}`
                    }
                    onAnimationComplete={resolveContainer}
                />
            )
            const { container, rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toHaveStyle(
            "transform: translateY(30px) translateX(30px)"
        )
    })
    test("animating between none/block fires onAnimationComplete", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => (
                <motion.div
                    initial={{ display: "none" }}
                    animate={{ display: "block" }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => {
                        resolve(true)
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual(true)
    })

    test("animate display none => block immediately switches to block", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => {
                const display = useMotionValue("block")
                let hasChecked = false

                return (
                    <motion.div
                        initial={{ display: "none", opacity: 0 }}
                        animate={{ display: "block", opacity: 1 }}
                        style={{ display }}
                        transition={{ duration: 0.1 }}
                        onUpdate={(latest) => {
                            if (!hasChecked) {
                                expect(latest.display).toBe("block")
                                hasChecked = true
                            }
                        }}
                        onAnimationComplete={() => {
                            resolve([hasChecked, display.get()])
                        }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual([true, "block"])
    })

    test("animate display block => none switches to none on animation end", async () => {
        const promise = new Promise((resolve) => {
            let hasChecked = false
            const Component = () => {
                const display = useMotionValue("block")

                return (
                    <motion.div
                        initial={{ display: "block", opacity: 1 }}
                        animate={{ display: "none", opacity: 0 }}
                        style={{ display }}
                        transition={{ duration: 0.1 }}
                        onUpdate={(latest) => {
                            if (!hasChecked) {
                                expect(latest.display).toBe("block")
                                hasChecked = true
                            }
                        }}
                        onAnimationComplete={() => {
                            resolve([hasChecked, display.get()])
                        }}
                    />
                )
            }
            render(<Component />)
        })
        return expect(promise).resolves.toEqual([true, "none"])
    })

    test("animate visibility hidden => visible immediately switches to visible", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => {
                const visibility = useMotionValue("visible")
                let hasChecked = false

                return (
                    <motion.div
                        initial={{ visibility: "hidden", opacity: 0 }}
                        animate={{ visibility: "visible", opacity: 1 }}
                        style={{ visibility }}
                        transition={{ duration: 0.1 }}
                        onUpdate={(latest) => {
                            if (!hasChecked) {
                                expect(latest.visibility).toBe("visible")
                                hasChecked = true
                            }
                        }}
                        onAnimationComplete={() => {
                            resolve([hasChecked, visibility.get()])
                        }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual([true, "visible"])
    })

    test("animate visibility visible => hidden switches to hidden on animation end", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => {
                const visibility = useMotionValue("hidden")
                let hasChecked = false

                return (
                    <motion.div
                        initial={{ visibility: "visible", opacity: 1 }}
                        animate={{ visibility: "hidden", opacity: 0 }}
                        style={{ visibility }}
                        transition={{ duration: 0.1 }}
                        onUpdate={(latest) => {
                            if (!hasChecked) {
                                expect(latest.visibility).toBe("visible")
                                hasChecked = true
                            }
                        }}
                        onAnimationComplete={() => {
                            resolve([hasChecked, visibility.get()])
                        }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual([true, "hidden"])
    })

    test("keyframes - accepts ease as an array", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const easingListener = jest.fn()
            const easing = (v: number) => {
                easingListener()
                return v
            }
            const onComplete = () => resolve(easingListener)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 1, 2] }}
                    transition={{ ease: [easing, easing], duration: 0.1 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toHaveBeenCalled()
    })
    test("will switch from non-animatable value to animatable value", async () => {
        const promise = new Promise((resolve) => {
            const onComplete = () => resolve(container.firstChild as Element)
            const Component = () => (
                <motion.div
                    animate={{ fontWeight: 100 }}
                    style={{ fontWeight: "normal" }}
                    onAnimationComplete={onComplete}
                />
            )
            const { container, rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toHaveStyle("font-weight: 100")
    })
    test("doesn't animate no-op values", async () => {
        const promise = new Promise(async (resolve) => {
            let isAnimating = false
            const Component = () => (
                <motion.div
                    initial={{ opacity: 1, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                        opacity: { duration: 2, type: "tween", velocity: 100 },
                        x: { type: "spring", velocity: 0 },
                    }}
                    onAnimationStart={() => {
                        isAnimating = true
                    }}
                    onAnimationComplete={() => {
                        isAnimating = false
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)

            await nextFrame()
            await nextFrame()

            resolve(isAnimating)
        })

        return expect(promise).resolves.toBe(false)
    })
    test("doesn't animate no-op keyframes", async () => {
        const promise = new Promise(async (resolve) => {
            let isAnimating = false
            const Component = () => (
                <motion.div
                    initial={{ opacity: 1, x: 0 }}
                    animate={{ opacity: [1, 1], x: [0, 0] }}
                    transition={{
                        opacity: { duration: 2, type: "tween", velocity: 100 },
                        x: { type: "spring", velocity: 0 },
                    }}
                    onAnimationStart={() => {
                        isAnimating = true
                    }}
                    onAnimationComplete={() => {
                        isAnimating = false
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)

            await nextFrame()
            await nextFrame()

            resolve(isAnimating)
        })

        return expect(promise).resolves.toBe(false)
    })
    test("does animate different keyframes", async () => {
        const promise = new Promise(async (resolve) => {
            let isAnimating = false
            const Component = () => (
                <motion.div
                    initial={{ opacity: 1, x: 0 }}
                    animate={{ opacity: [0, 1], x: [0, 1] }}
                    transition={{
                        opacity: { duration: 2, type: "tween", velocity: 100 },
                        x: { type: "spring", velocity: 0 },
                    }}
                    onAnimationStart={() => {
                        isAnimating = true
                    }}
                    onAnimationComplete={() => {
                        isAnimating = false
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)

            await nextFrame()
            await nextFrame()

            resolve(isAnimating)
        })

        return expect(promise).resolves.toBe(true)
    })
    test("does animate no-op values if velocity is non-zero and animation type is spring", async () => {
        const promise = new Promise<boolean>((resolve) => {
            let isAnimating = false
            const Component = () => (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{
                        opacity: 1,
                        transition: { type: "spring", velocity: 100 },
                    }}
                    onAnimationStart={() => {
                        isAnimating = true
                    }}
                    onAnimationComplete={() => {
                        isAnimating = false
                    }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)

            frame.postRender(() => {
                frame.postRender(() => resolve(isAnimating))
            })
        })

        return expect(promise).resolves.toBe(true)
    })
    test("doesn't animate zIndex", async () => {
        const promise = new Promise(async (resolve) => {
            const Component = () => <motion.div animate={{ zIndex: 100 }} />
            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            await nextFrame()
            resolve(container.firstChild as Element)
        })
        return expect(promise).resolves.toHaveStyle("z-index: 100")
    })

    test("when value is removed from animate, animates back to value originally defined in initial prop", async () => {
        return new Promise<void>(async (resolve) => {
            const ref = createRef()

            const props: any = {
                ref,
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { type: false },
            }

            const { rerender } = render(<motion.div {...props} />)

            rerender(<motion.div {...props} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 1")

            rerender(<motion.div {...props} animate={{}} />)
            rerender(<motion.div {...props} animate={{}} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 0")

            resolve()
        })
    })

    test("when value is removed from animate, animates back to value currently defined in initial prop", async () => {
        return new Promise<void>(async (resolve) => {
            const ref = createRef()

            const props: any = {
                ref,
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { type: false },
            }

            const { rerender } = render(<motion.div {...props} />)

            rerender(<motion.div {...props} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 1")

            rerender(
                <motion.div
                    {...props}
                    initial={{ opacity: 0.5 }}
                    animate={{}}
                />
            )
            rerender(
                <motion.div
                    {...props}
                    initial={{ opacity: 0.5 }}
                    animate={{}}
                />
            )

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 0.5")

            resolve()
        })
    })

    test("when value is removed from both animate and initial, perform no animation", async () => {
        return new Promise<void>(async (resolve) => {
            const ref = createRef()

            const props: any = {
                ref,
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { type: false },
            }

            const { rerender } = render(<motion.div {...props} />)

            rerender(<motion.div {...props} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 1")

            rerender(<motion.div {...props} initial={{}} animate={{}} />)
            rerender(<motion.div {...props} initial={{}} animate={{}} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 1")

            resolve()
        })
    })

    test("accepts default transition prop", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const opacity = motionValue(0)

            const Component = () => (
                <motion.div
                    animate={{ opacity: 1, x: 20 }}
                    transition={{
                        default: { type: false },
                        x: { type: "tween", from: 10, ease: () => 0.5 },
                    }}
                    onUpdate={() => {
                        frame.read(() => {
                            resolve([x.get(), opacity.get()])
                        })
                    }}
                    style={{ x, opacity }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual([15, 1])
    })

    test("accepts base transition settings", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const opacity = motionValue(0)

            const Component = () => (
                <motion.div
                    animate={{ opacity: 1, x: 20 }}
                    transition={{
                        type: false,
                        duration: 1,
                        x: { type: "tween", from: 10, ease: () => 0.5 },
                    }}
                    onUpdate={() => {
                        frame.read(() => {
                            resolve([x.get(), opacity.get()])
                        })
                    }}
                    style={{ x, opacity }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toEqual([15, 1])
    })

    test("when value is removed from animate, animate back to value read from DOM", async () => {
        return new Promise<void>(async (resolve) => {
            const ref = createRef()

            const props: any = {
                ref,
                style: { opacity: 0.5 },
                animate: { opacity: 1 },
                transition: { type: false },
            }

            const { rerender } = render(<motion.div {...props} />)

            rerender(<motion.div {...props} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 1")

            rerender(<motion.div {...props} animate={{}} />)
            rerender(<motion.div {...props} animate={{}} />)

            await nextFrame()

            expect(ref.current).toHaveStyle("opacity: 0.5")

            resolve()
        })
    })

    test("respects repeatDelay prop", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            x.on("change", () => {
                setTimeout(() => resolve(x.get()), 50)
            })
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0,
                            repeatDelay: 0.1,
                            repeat: 1,
                            repeatType: "reverse",
                        },
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })

    test("Correctly applies final keyframe with repeatType reverse and odd numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 1,
                            repeatType: "reverse",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(0)
    })

    test("Correctly applies final keyframe with repeatType mirror and odd numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 1,
                            repeatType: "mirror",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(0)
    })

    test("Correctly applies final keyframe with repeatType loop and odd numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 1,
                            repeatType: "loop",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })

    test("Correctly applies final keyframe with repeatType reverse and even numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 2,
                            repeatType: "reverse",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })

    test("Correctly applies final keyframe with repeatType mirror and even numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 2,
                            repeatType: "mirror",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })

    test("Correctly applies final keyframe with repeatType loop and even numbered repeat", async () => {
        const promise = new Promise<number>((resolve) => {
            const x = motionValue(0)
            const Component = () => (
                <motion.div
                    animate={{ x: [0, 20] }}
                    transition={{
                        x: {
                            type: "tween",
                            duration: 0.1,
                            repeatDelay: 0.1,
                            repeat: 2,
                            repeatType: "loop",
                        },
                    }}
                    onAnimationComplete={() => {
                        frame.postRender(() => resolve(x.get()))
                    }}
                    style={{ x }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        return expect(promise).resolves.toBe(20)
    })

    test("animates previously unseen properties, instant animation", async () => {
        const Component = ({ animate }: any) => (
            <motion.div animate={animate} transition={{ type: false }} />
        )
        const { container, rerender } = render(
            <Component animate={{ x: 100 }} />
        )
        rerender(<Component animate={{ x: 100 }} />)

        rerender(<Component animate={{ y: 100 }} />)
        rerender(<Component animate={{ y: 100 }} />)

        await nextFrame()

        return expect(container.firstChild as Element).toHaveStyle(
            "transform: translateY(100px)"
        )
    })

    test("animates previously unseen properties", async () => {
        const Component = ({ animate }: any) => (
            <motion.div animate={animate} transition={{ duration: 0 }} />
        )
        const { container, rerender } = render(
            <Component animate={{ x: 100 }} />
        )
        rerender(<Component animate={{ x: 100 }} />)

        rerender(<Component animate={{ y: 100 }} />)
        rerender(<Component animate={{ y: 100 }} />)

        await nextFrame()
        await nextFrame()

        return expect(container.firstChild as Element).toHaveStyle(
            "transform: translateY(100px)"
        )
    })

    test("converts unseen zero unit types to number", async () => {
        const promise = new Promise<ChildNode>((resolve) => {
            const Component = () => (
                <motion.div
                    animate={{ borderRadius: 20 }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => {
                        resolve(container.firstChild as ChildNode)
                    }}
                    style={{ borderRadius: "0px" }}
                />
            )
            const { container, rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toHaveStyle("border-radius: 20px")
    })

    test("animates previously unseen CSS variables", async () => {
        const promise = new Promise<string>((resolve) => {
            let latestColor = ""
            const Component = () => (
                <motion.div
                    style={{ "--foo": "#fff" } as any}
                    animate={{ "--foo": "#000" } as any}
                    onUpdate={(latest) => {
                        latestColor = latest["--foo"] as string
                    }}
                    onAnimationComplete={() => {
                        resolve(latestColor)
                    }}
                    transition={{ type: false }}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe("rgba(0, 0, 0, 1)")
    })

    test("forces an animation to fallback if has been set to `null`", async () => {
        const promise = new Promise(async (resolve) => {
            const complete = () => resolve(true)
            const Component = ({ animate, onAnimationComplete }: any) => (
                <motion.div
                    animate={animate}
                    onAnimationComplete={onAnimationComplete}
                    transition={{ type: false }}
                />
            )
            const { container, rerender } = render(
                <Component animate={{ x: 100 }} />
            )
            await nextFrame()
            rerender(<Component animate={{ x: null }} />)
            rerender(<Component animate={{ x: null }} />)
            await nextFrame()
            expect(container.firstChild as Element).toHaveStyle(
                "transform: none"
            )
            rerender(
                <Component
                    animate={{ x: 100 }}
                    onAnimationComplete={complete}
                />
            )
            rerender(
                <Component
                    animate={{ x: 100 }}
                    onAnimationComplete={complete}
                />
            )
        })
        return expect(promise).resolves.toBe(true)
    })
    test("mount animation doesn't run if `initial={false}`", async () => {
        const onComplete = jest.fn()
        const x = motionValue(0)
        const y = motionValue(0)
        const z = motionValue(0)
        const promise = new Promise<void>((resolve) => {
            const Component = () => (
                <motion.div
                    initial={false}
                    animate={{
                        x: 20,
                        y: 20,
                        transitionEnd: { x: 10, z: 20 },
                    }}
                    transition={{ type: false }}
                    style={{ x, y, z }}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
            setTimeout(() => resolve(), 10)
        })
        await promise
        expect(onComplete).not.toBeCalled()
        expect([x.get(), y.get(), z.get()]).toEqual([10, 20, 20])
    })
    test("unmount cancels active animations", async () => {
        const promise = new Promise((resolve) => {
            const onComplete = jest.fn()
            const Component = ({ isVisible }: any) =>
                isVisible && (
                    <motion.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.2 }}
                        onAnimationComplete={() => onComplete()}
                    />
                )
            const { rerender } = render(<Component isVisible />)
            rerender(<Component isVisible />)
            setTimeout(() => {
                rerender(<Component isVisible={false} />)
                rerender(<Component isVisible={false} />)
            }, 100)
            setTimeout(() => {
                resolve(onComplete)
            }, 300)
        })
        return expect(promise).resolves.not.toBeCalled()
    })

    test("animate prop accepts pathOffset", () => {
        const Component = () => (
            <motion.div animate={{ pathOffset: 1, pathSpacing: 1 }} />
        )
        render(<Component />)
    })

    test("Correctly animates from RGB to HSLA", async () => {
        const element = await new Promise<HTMLDivElement>((resolve) => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                return (
                    <motion.div
                        ref={ref}
                        initial={{ backgroundColor: "rgb(0, 153, 255)" }}
                        animate={{ backgroundColor: "hsl(345, 100%, 60%)" }}
                        onAnimationComplete={() =>
                            ref.current && resolve(ref.current)
                        }
                        transition={{ duration: 0.01 }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(element).toHaveStyle(
            "background-color: rgba(255, 51, 102, 1)"
        )
    })

    test("Correctly animates from HEX to HSLA", async () => {
        const element = await new Promise<HTMLDivElement>((resolve) => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                return (
                    <motion.div
                        ref={ref}
                        initial={{ backgroundColor: "#0088ff" }}
                        animate={{ backgroundColor: "hsl(345, 100%, 60%)" }}
                        onAnimationComplete={() => {
                            ref.current && resolve(ref.current)
                        }}
                        transition={{ duration: 0.01 }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(element).toHaveStyle(
            "background-color: rgba(255, 51, 102, 1)"
        )
    })

    test("Correctly animates from HSLA to Hex", async () => {
        const element = await new Promise<HTMLDivElement>((resolve) => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                return (
                    <motion.div
                        ref={ref}
                        initial={{ backgroundColor: "hsla(345, 100%, 60%, 1)" }}
                        animate={{ backgroundColor: "#0088ff" }}
                        onAnimationComplete={() =>
                            ref.current && resolve(ref.current)
                        }
                        transition={{ duration: 0.01 }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(element).toHaveStyle(
            "background-color: rgba(0, 136, 255, 1)"
        )
    })

    test("Correctly animates from HSLA to RGB", async () => {
        const element = await new Promise<HTMLDivElement>((resolve) => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                return (
                    <motion.div
                        ref={ref}
                        initial={{ backgroundColor: "hsla(345, 100%, 60%, 1)" }}
                        animate={{ backgroundColor: "rgba(0, 136, 255, 1)" }}
                        onAnimationComplete={() =>
                            ref.current && resolve(ref.current)
                        }
                        transition={{ duration: 0.01 }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(element).toHaveStyle(
            "background-color: rgba(0, 136, 255, 1)"
        )
    })

    test("animationStart event fires as expected", async () => {
        const testFn = await new Promise<Function>((resolve) => {
            const fn = jest.fn()
            const Component = () => {
                const x = useMotionValue(0)
                useMotionValueEvent(x, "animationStart", fn)

                return (
                    <motion.div
                        animate={{ x: 100 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onUpdate={() => resolve(fn)}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(testFn).toHaveBeenCalled()
    })

    test("doesn't error when provided unknown animation type", async () => {
        const Component = () => {
            return (
                <motion.div
                    animate={{ x: 100 }}
                    transition={{ type: "test" } as any}
                />
            )
        }
        const { rerender } = render(<Component />)
        rerender(<Component />)
    })

    test("Correctly animates complex value types on first rerender", async () => {
        const result = await new Promise<string[]>((resolve) => {
            const output: string[] = []
            const Component = () => {
                return (
                    <motion.div
                        animate={{
                            background:
                                "linear-gradient(0deg, hsl(216, 100%, 50%) 0%, hsl(301, 100%, 50%) 100%)",
                        }}
                        onUpdate={({ background }) =>
                            output.push(background as string)
                        }
                        onAnimationComplete={() => resolve(output)}
                        style={{
                            background:
                                "linear-gradient(180deg, hsl(216, 100%, 50%) 0%, hsl(301, 100%, 50%) 100%)",
                        }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(result.length).not.toBe(1)
    })

    test("Doesn't double-add listeners to externally-provided motion values", async () => {
        const result = await new Promise<number>((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                return (
                    <motion.div
                        animate={{ x: 100 }}
                        transition={{ duration: 0.01 }}
                        onAnimationStart={() =>
                            resolve((x as any).events.change.getSize())
                        }
                        style={{ x }}
                    />
                )
            }
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(result).toBe(1)
    })
})
