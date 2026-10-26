import { render } from "@testing-library/react"
import { delay, hover, motionValue } from "motion-dom"
import { StrictMode, useRef } from "react"
import { MotionConfig } from "../../../components/MotionConfig"
import { motion } from "../../../render/components/motion/proxy"
import { animate, createScopedAnimate } from "../../animate"
import { timeline } from "../../timeline"
import { useScopeMotion } from "../use-scope-motion"

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

describe("useScopeMotion", () => {
    test("resolves selectors inside the ref", async () => {
        const Component = () => {
            const ref = useRef<HTMLDivElement>(null)
            useScopeMotion(ref, () => {
                animate(".box", { opacity: 0.5 }, { duration: 0 })
            })
            return (
                <div ref={ref}>
                    <div className="box" data-testid="inside" />
                </div>
            )
        }

        const outside = document.createElement("div")
        outside.className = "box"
        document.body.appendChild(outside)

        const { getByTestId } = render(<Component />)
        await nextFrame()
        await nextFrame()

        expect(getByTestId("inside").style.opacity).toBe("0.5")
        expect(outside.style.opacity).toBe("")
        outside.remove()
    })

    test("cancels the scope on unmount", async () => {
        const delayed = jest.fn()
        let element: HTMLElement | null = null

        const Component = () => {
            const ref = useRef<HTMLDivElement>(null)
            useScopeMotion(ref, () => {
                element = ref.current
                animate(ref.current!, { x: 100 }, { duration: 10 })
                delay(delayed, 1000)
            })
            return <div ref={ref} style={{ color: "red" }} />
        }

        const { unmount } = render(<Component />)
        await nextFrame()
        await nextFrame()
        expect(element!.style.transform).not.toBe("")

        unmount()
        await new Promise((resolve) => setTimeout(resolve, 1100))

        expect(delayed).not.toHaveBeenCalled()
        expect(element!.getAttribute("style")).toBe("color: red;")
    })

    test("reruns setup when deps change", () => {
        const setup = jest.fn()
        const cleanup = jest.fn()

        const Component = ({ value }: { value: number }) => {
            const ref = useRef<HTMLDivElement>(null)
            useScopeMotion(
                ref,
                () => {
                    setup(value)
                    return cleanup
                },
                { deps: [value] }
            )
            return <div ref={ref} />
        }

        const { rerender } = render(<Component value={1} />)
        rerender(<Component value={1} />)
        expect(setup).toHaveBeenCalledTimes(1)

        rerender(<Component value={2} />)
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(setup).toHaveBeenLastCalledWith(2)
    })

    test("returns the current scope for event handlers", () => {
        let scope: ReturnType<typeof useScopeMotion> | undefined

        const Component = () => {
            const ref = useRef<HTMLDivElement>(null)
            scope = useScopeMotion(ref, () => {})
            return <div ref={ref} />
        }

        const { unmount } = render(<Component />)
        const current = scope!.current!
        expect(current.state).toBe("active")

        const stopHover = current.run(() => hover(document.body, () => {}))
        expect(typeof stopHover).toBe("function")

        unmount()
        expect(current.state).toBe("cancelled")
        expect(scope!.current).toBe(null)
    })

    test("leaves one active scope in StrictMode", () => {
        const setup = jest.fn()
        const scopes: any[] = []

        const Component = () => {
            const ref = useRef<HTMLDivElement>(null)
            useScopeMotion(ref, (s) => {
                setup()
                scopes.push(s)
            })
            return <div ref={ref} />
        }

        render(
            <StrictMode>
                <Component />
            </StrictMode>
        )

        expect(scopes.filter((s) => s.state === "active").length).toBe(1)
    })

    describe("timeline()", () => {
        test("resolves selectors inside the ref", async () => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    timeline([[".box", { opacity: 0.5 }, { duration: 0 }]])
                })
                return (
                    <div ref={ref}>
                        <div className="box" data-testid="inside" />
                    </div>
                )
            }

            const outside = document.createElement("div")
            outside.className = "box"
            document.body.appendChild(outside)

            const { getByTestId } = render(<Component />)
            await nextFrame()
            await nextFrame()

            expect(getByTestId("inside").style.opacity).toBe("0.5")
            expect(outside.style.opacity).toBe("")
            outside.remove()
        })

        test("stops and restores styles on unmount", async () => {
            let element: HTMLElement | null = null

            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    element = ref.current
                    timeline([[ref.current!, { x: 100 }, { duration: 10 }]])
                })
                return <div ref={ref} style={{ color: "red" }} />
            }

            const { unmount } = render(<Component />)
            await nextFrame()
            await nextFrame()
            expect(element!.style.transform).not.toBe("")

            unmount()
            await nextFrame()
            expect(element!.getAttribute("style")).toBe("color: red;")
        })

        test("is stopped and created again when deps change", async () => {
            const values: ReturnType<typeof motionValue<number>>[] = []

            const Component = ({ value }: { value: number }) => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(
                    ref,
                    () => {
                        const v = motionValue(0)
                        values.push(v)
                        timeline([[v, 100, { duration: 10 }]])
                    },
                    { deps: [value] }
                )
                return <div ref={ref} />
            }

            const { rerender, unmount } = render(<Component value={1} />)
            await nextFrame()
            rerender(<Component value={2} />)
            await nextFrame()

            expect(values.length).toBe(2)
            const first = values[0].get()
            await nextFrame()
            await nextFrame()
            expect(values[0].get()).toBe(first)
            expect(values[1].get()).toBeGreaterThan(0)
            unmount()
        })

        test("inherits skipAnimations from MotionConfig", async () => {
            const v = motionValue(0)
            const a = motionValue(0)

            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    timeline([[v, 100, { duration: 10 }]])
                    animate(a, 100, { duration: 10 })
                })
                return <div ref={ref} />
            }

            render(
                <MotionConfig skipAnimations>
                    <Component />
                </MotionConfig>
            )
            await nextFrame()
            await nextFrame()

            expect(v.get()).toBe(100)
            expect(a.get()).toBe(100)
        })

        test("animate() in the same scope inherits reducedMotion from MotionConfig", async () => {
            let element: HTMLElement | null = null

            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    element = ref.current
                    animate(ref.current!, { x: 100 }, { duration: 10 })
                })
                return <div ref={ref} />
            }

            render(
                <MotionConfig reducedMotion="always">
                    <Component />
                </MotionConfig>
            )
            await nextFrame()
            await nextFrame()

            expect(element!.style.transform).toBe("translateX(100px)")
        })

        test("follows reducedMotion from MotionConfig", async () => {
            let element: HTMLElement | null = null

            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    element = ref.current
                    timeline([[ref.current!, { x: 100 }, { duration: 10 }]])
                })
                return <div ref={ref} />
            }

            render(
                <MotionConfig reducedMotion="always">
                    <Component />
                </MotionConfig>
            )
            await nextFrame()
            await nextFrame()

            expect(element!.style.transform).toBe("translateX(100px)")
        })
    })

    describe("MotionConfig defaults", () => {
        test("don't override skipAnimations set by a scoped animate()", async () => {
            const v = motionValue(0)

            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    createScopedAnimate({ skipAnimations: true })(v, 100, {
                        duration: 10,
                    })
                })
                return <div ref={ref} />
            }

            render(<Component />)
            await nextFrame()
            await nextFrame()

            expect(v.get()).toBe(100)
        })

        test("don't override reducedMotion of a motion component's own MotionConfig", async () => {
            const Component = () => {
                const ref = useRef<HTMLDivElement>(null)
                useScopeMotion(ref, () => {
                    animate(".box", { x: 100 }, { duration: 10 })
                })
                return (
                    <div ref={ref}>
                        <MotionConfig reducedMotion="always">
                            <motion.div className="box" data-testid="box" />
                        </MotionConfig>
                    </div>
                )
            }

            const { getByTestId } = render(<Component />)
            await nextFrame()
            await nextFrame()

            expect(getByTestId("box").style.transform).toBe("translateX(100px)")
        })
    })
})
