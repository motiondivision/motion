import "@testing-library/jest-dom"
import { render } from "@testing-library/react"
import { useEffect } from "react"
import { MotionConfig } from "../../../components/MotionConfig"
import { nextFrame } from "../../../gestures/__tests__/utils"
import { useAnimate } from "../use-animate"

describe("useAnimate", () => {
    test("Types work as expected", () => {
        const Component = () => {
            const [scope, animate] = useAnimate()

            useEffect(() => {
                expect(() => {
                    animate("div", { opacity: 1 })
                }).toThrow()

                animate(scope.current, { opacity: 1 })
            })

            return <div ref={scope} />
        }

        render(<Component />)
    })

    test("Animations removed from scope when finished", () => {
        return new Promise<void>((resolve) => {
            const Component = () => {
                const [scope, animate] = useAnimate()

                useEffect(() => {
                    const animation = animate(
                        scope.current,
                        { opacity: 1 },
                        { duration: 0.1 }
                    )

                    requestAnimationFrame(() => {
                        expect(scope.animations.length).toBe(1)
                    })

                    animation.finished.then(() => {
                        requestAnimationFrame(() => {
                            expect(scope.animations.length).toBe(0)
                            resolve()
                        })
                    })

                    return () => {
                        animation.stop()
                    }
                })

                return <div ref={scope} />
            }

            render(<Component />)
        })
    })

    test("Animates provided animation", async () => {
        return new Promise<void>((resolve) => {
            const Component = () => {
                const [scope, animate] = useAnimate()

                useEffect(() => {
                    animate(
                        scope.current,
                        { opacity: 0.5 },
                        { duration: 0.1 }
                    ).then(() => {
                        expect(scope.current).toHaveStyle("opacity: 0.5;")
                        resolve()
                    })
                })

                return <div ref={scope} />
            }

            render(<Component />)
        })
    })

    test("Stops animations when unmounted", async () => {
        let frameCount = 0
        let unmount = () => {}

        await new Promise<void>((resolve) => {
            const Component = () => {
                const [scope, animate] = useAnimate()

                useEffect(() => {
                    animate(
                        scope.current,
                        { opacity: 0.5 },
                        {
                            duration: 20,
                            onUpdate: () => {
                                frameCount++
                                if (frameCount === 3) {
                                    unmount()
                                    setTimeout(() => {
                                        resolve()
                                    }, 50)
                                }
                            },
                        }
                    )
                })

                return <div ref={scope} />
            }

            unmount = render(<Component />).unmount
        })

        expect(frameCount).toEqual(3)
    })

    test("reducedMotion='always' option makes transforms animate instantly", async () => {
        const result = await new Promise<{ x: string; opacity: string }>(
            (resolve) => {
                const Component = () => {
                    const [scope, animate] = useAnimate<HTMLDivElement>({
                        reducedMotion: "always",
                    })

                    useEffect(() => {
                        animate(
                            scope.current,
                            { x: 100, opacity: 1 },
                            { duration: 2 }
                        )

                        nextFrame().then(() => {
                            const style = getComputedStyle(scope.current)
                            resolve({
                                x: style.transform,
                                opacity: style.opacity,
                            })
                        })
                    })

                    return <div ref={scope} />
                }

                render(<Component />)
            }
        )

        expect(result.x).toContain("translateX(100px)")
        expect(result.opacity).not.toEqual("1")
    })

    test("reducedMotion='never' option overrides parent MotionConfig reducedMotion='always'", async () => {
        const result = await new Promise<{ x: string; opacity: string }>(
            (resolve) => {
                const Component = () => {
                    const [scope, animate] = useAnimate<HTMLDivElement>({
                        reducedMotion: "never",
                    })

                    useEffect(() => {
                        animate(
                            scope.current,
                            { x: 100, opacity: 1 },
                            { duration: 2 }
                        )

                        nextFrame().then(() => {
                            const style = getComputedStyle(scope.current)
                            resolve({
                                x: style.transform,
                                opacity: style.opacity,
                            })
                        })
                    })

                    return <div ref={scope} />
                }

                render(
                    <MotionConfig reducedMotion="always">
                        <Component />
                    </MotionConfig>
                )
            }
        )

        expect(result.x).not.toContain("translateX(100px)")
        expect(result.opacity).not.toEqual("1")
    })

    test("Applies final value instantly when MotionConfig skipAnimations is true", () => {
        return new Promise<void>((resolve) => {
            const Component = () => {
                const [scope, animate] = useAnimate()

                useEffect(() => {
                    animate(
                        scope.current,
                        { opacity: 0.5 },
                        { duration: 10 }
                    )

                    setTimeout(() => {
                        expect(scope.current).toHaveStyle("opacity: 0.5;")
                        expect(scope.animations.length).toBe(0)
                        resolve()
                    }, 50)
                })

                return <div ref={scope} />
            }

            render(
                <MotionConfig skipAnimations>
                    <Component />
                </MotionConfig>
            )
        })
    })
})
