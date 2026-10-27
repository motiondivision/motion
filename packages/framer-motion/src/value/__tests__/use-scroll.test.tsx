import { frame, supportsFlags } from "motion-dom"
import { useRef } from "react"
import { render } from "../../jest.setup"
import { useScroll } from "../use-scroll"
import { useTransform } from "../use-transform"

describe("useScroll accelerate", () => {
    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        supportsFlags.viewTimeline = undefined
    })

    test("sets accelerate on progress values when ScrollTimeline is supported and no target", () => {
        supportsFlags.scrollTimeline = true

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const { scrollXProgress, scrollYProgress } = useScroll()
            accelerateX = scrollXProgress.accelerate
            accelerateY = scrollYProgress.accelerate
            return null
        }

        render(<Component />)

        expect(accelerateX).toBeDefined()
        expect(accelerateY).toBeDefined()
    })

    test("sets accelerate when target ref is provided and ViewTimeline is supported", () => {
        supportsFlags.viewTimeline = true

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const target = useRef<HTMLDivElement>(null)
            const { scrollXProgress, scrollYProgress } = useScroll({
                target,
            })
            accelerateX = scrollXProgress.accelerate
            accelerateY = scrollYProgress.accelerate
            return <div ref={target} />
        }

        render(<Component />)

        expect(accelerateX).toBeDefined()
        expect(accelerateY).toBeDefined()
    })

    test("does not set accelerate when target ref is provided and ViewTimeline is not supported", () => {
        supportsFlags.scrollTimeline = true
        supportsFlags.viewTimeline = false

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const target = useRef<HTMLDivElement>(null)
            const { scrollXProgress, scrollYProgress } = useScroll({
                target,
            })
            accelerateX = scrollXProgress.accelerate
            accelerateY = scrollYProgress.accelerate
            return <div ref={target} />
        }

        render(<Component />)

        expect(accelerateX).toBeUndefined()
        expect(accelerateY).toBeUndefined()
    })

    test("does not set accelerate when target offset has no ViewTimeline range", () => {
        supportsFlags.viewTimeline = true

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const target = useRef<HTMLDivElement>(null)
            const { scrollXProgress, scrollYProgress } = useScroll({
                target,
                offset: ["start center", "end start"],
            })
            accelerateX = scrollXProgress.accelerate
            accelerateY = scrollYProgress.accelerate
            return <div ref={target} />
        }

        render(<Component />)

        expect(accelerateX).toBeUndefined()
        expect(accelerateY).toBeUndefined()
    })

    test("does not set accelerate when ScrollTimeline is not supported", () => {
        supportsFlags.scrollTimeline = false

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const { scrollXProgress, scrollYProgress } = useScroll()
            accelerateX = scrollXProgress.accelerate
            accelerateY = scrollYProgress.accelerate
            return null
        }

        render(<Component />)

        expect(accelerateX).toBeUndefined()
        expect(accelerateY).toBeUndefined()
    })

    test("propagates accelerate through useTransform", () => {
        supportsFlags.scrollTimeline = true

        let transformAccelerate: any

        const Component = () => {
            const { scrollYProgress } = useScroll()
            const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])
            transformAccelerate = opacity.accelerate
            return null
        }

        render(<Component />)

        expect(transformAccelerate).toBeDefined()
    })

    test("holds useTransform's end values across the whole accelerated timeline", () => {
        supportsFlags.scrollTimeline = true

        let transformAccelerate: any

        const Component = () => {
            const { scrollYProgress } = useScroll()
            const opacity = useTransform(
                scrollYProgress,
                [0.25, 0.5],
                [0.2, 1],
                { ease: [(v: number) => v] }
            )
            transformAccelerate = opacity.accelerate
            return null
        }

        render(<Component />)

        // WAAPI fills missing 0 and 1 offsets with the underlying value
        expect(transformAccelerate.times).toEqual([0, 0.25, 0.5, 1])
        expect(transformAccelerate.keyframes).toEqual([0.2, 0.2, 1, 1])
        // An extra leading ease keeps each easing on its original segment
        expect(transformAccelerate.ease).toHaveLength(2)
    })

    test("doesn't accelerate useTransform with a mixer, as WAAPI can't call it", () => {
        supportsFlags.scrollTimeline = true

        let transformAccelerate: any

        const Component = () => {
            const { scrollYProgress } = useScroll()
            const filter = useTransform(
                scrollYProgress,
                [0, 1],
                ["blur(0px)", "blur(10px)"],
                { mixer: () => () => "blur(5px)" }
            )
            transformAccelerate = filter.accelerate
            return null
        }

        render(<Component />)

        expect(transformAccelerate).toBeUndefined()
    })
})

describe("useScroll scrollXLength/scrollYLength (#2189)", () => {
    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        supportsFlags.viewTimeline = undefined
    })

    const mock = (element: Element, values: Record<string, number>) => {
        for (const key in values) {
            Object.defineProperty(element, key, {
                value: values[key],
                configurable: true,
            })
        }
    }

    const nextFrames = () =>
        new Promise<void>((resolve) =>
            frame.postRender(() => frame.postRender(() => resolve()))
        )

    const containerSize = {
        clientWidth: 400,
        scrollWidth: 400,
        scrollLeft: 0,
        clientHeight: 500,
        scrollHeight: 3000,
        scrollTop: 500,
    }

    test("exposes each axis's maximum scroll offset", async () => {
        let values: ReturnType<typeof useScroll> | undefined

        const Component = () => {
            const container = useRef<HTMLDivElement>(null)
            values = useScroll({ container })
            return (
                <div
                    ref={(element) => {
                        if (!element) return
                        mock(element, {
                            clientWidth: 400,
                            scrollWidth: 1000,
                            scrollLeft: 100,
                            clientHeight: 500,
                            scrollHeight: 3000,
                            scrollTop: 500,
                        })
                        ;(container as any).current = element
                    }}
                />
            )
        }

        render(<Component />)

        await nextFrames()

        const {
            scrollX,
            scrollY,
            scrollYProgress,
            scrollXLength,
            scrollYLength,
        } = values!

        expect(scrollY.get()).toBe(500)
        expect(scrollYProgress.get()).toBe(0.2)
        expect(scrollYLength.get()).toBe(2500)

        expect(scrollX.get()).toBe(100)
        expect(scrollXLength.get()).toBe(600)

        // Distance from the end, as asked for in #2189
        expect(scrollYLength.get() - scrollY.get()).toBe(2000)
    })

    test("is the container's maximum scroll offset when tracking a target with an offset", async () => {
        let values: ReturnType<typeof useScroll> | undefined

        const Component = () => {
            const container = useRef<HTMLDivElement>(null)
            const target = useRef<HTMLDivElement>(null)
            values = useScroll({
                container,
                target,
                offset: ["start end", "end start"],
            })
            return (
                <div
                    style={{ position: "relative" }}
                    ref={(element) => {
                        if (!element) return
                        mock(element, { ...containerSize, scrollTop: 850 })
                        ;(container as any).current = element
                    }}
                >
                    <div
                        ref={(element) => {
                            if (!element) return
                            mock(element, {
                                offsetTop: 1000,
                                offsetLeft: 0,
                                clientWidth: 400,
                                clientHeight: 200,
                            })
                            Object.defineProperty(element, "offsetParent", {
                                value: element.parentElement,
                                configurable: true,
                            })
                            ;(target as any).current = element
                        }}
                    />
                </div>
            )
        }

        render(<Component />)
        await nextFrames()

        const { scrollY, scrollYProgress, scrollYLength } = values!

        // Progress follows the target: offsets resolve to 500 and 1200
        expect(scrollY.get()).toBe(850)
        expect(scrollYProgress.get()).toBe(0.5)
        expect(scrollYLength.get()).toBe(2500)
    })

    test("updates when the container resizes", async () => {
        let values: ReturnType<typeof useScroll> | undefined
        let containerElement: HTMLDivElement | undefined

        const Component = () => {
            const container = useRef<HTMLDivElement>(null)
            values = useScroll({ container })
            return (
                <div
                    ref={(element) => {
                        if (!element) return
                        mock(element, containerSize)
                        containerElement = element
                        ;(container as any).current = element
                    }}
                />
            )
        }

        render(<Component />)
        await nextFrames()
        expect(values!.scrollYLength.get()).toBe(2500)

        mock(containerElement!, { clientHeight: 1000 })
        window.dispatchEvent(new Event("resize"))
        await nextFrames()

        expect(values!.scrollYLength.get()).toBe(2000)
        expect(values!.scrollYProgress.get()).toBe(0.25)
    })

    test("is set alongside accelerated progress values", async () => {
        supportsFlags.scrollTimeline = true

        let values: ReturnType<typeof useScroll> | undefined

        const Component = () => {
            const container = useRef<HTMLDivElement>(null)
            values = useScroll({ container })
            return (
                <div
                    ref={(element) => {
                        if (!element) return
                        mock(element, containerSize)
                        ;(container as any).current = element
                    }}
                />
            )
        }

        render(<Component />)
        await nextFrames()

        expect(values!.scrollYProgress.accelerate).toBeDefined()
        expect(values!.scrollYLength.accelerate).toBeUndefined()
        expect(values!.scrollYLength.get()).toBe(2500)
    })
})
