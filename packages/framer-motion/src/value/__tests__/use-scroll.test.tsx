import { supportsFlags } from "motion-dom"
import { useRef } from "react"
import { render } from "../../jest.setup"
import { useScroll } from "../use-scroll"
import { useTransform } from "../use-transform"

describe("useScroll startAtZero", () => {
    let originalScrollingElement: Element | null

    beforeAll(() => {
        originalScrollingElement = document.scrollingElement
    })

    function mockScrollingElement(
        scrollTop: number,
        scrollLeft: number
    ) {
        const el = document.createElement("div")
        Object.defineProperty(el, "scrollTop", { value: scrollTop })
        Object.defineProperty(el, "scrollLeft", { value: scrollLeft })
        Object.defineProperty(el, "scrollHeight", { value: 2000 })
        Object.defineProperty(el, "clientHeight", { value: 1000 })
        Object.defineProperty(el, "scrollWidth", { value: 2000 })
        Object.defineProperty(el, "clientWidth", { value: 1000 })
        Object.defineProperty(document, "scrollingElement", {
            value: el,
            configurable: true,
        })
        return el
    }

    afterEach(() => {
        Object.defineProperty(document, "scrollingElement", {
            value: originalScrollingElement,
            configurable: true,
        })
    })

    test("initializes values to current scroll position when startAtZero is false", () => {
        mockScrollingElement(500, 100)

        let scrollX = 0
        let scrollY = 0
        let scrollXProgress = 0
        let scrollYProgress = 0

        const Component = () => {
            const values = useScroll({ startAtZero: false })
            scrollX = values.scrollX.get()
            scrollY = values.scrollY.get()
            scrollXProgress = values.scrollXProgress.get()
            scrollYProgress = values.scrollYProgress.get()
            return null
        }

        render(<Component />)

        expect(scrollY).toBe(500)
        expect(scrollX).toBe(100)
        expect(scrollYProgress).toBe(0.5)
        expect(scrollXProgress).toBe(0.1)
    })

    test("defaults to zero when startAtZero is not set", () => {
        mockScrollingElement(500, 100)

        let scrollY = -1
        let scrollYProgress = -1

        const Component = () => {
            const values = useScroll()
            scrollY = values.scrollY.get()
            scrollYProgress = values.scrollYProgress.get()
            return null
        }

        render(<Component />)

        expect(scrollY).toBe(0)
        expect(scrollYProgress).toBe(0)
    })
})

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

    test("does not set accelerate when target has non-preset string offset", () => {
        supportsFlags.viewTimeline = true

        let accelerateX: any
        let accelerateY: any

        const Component = () => {
            const target = useRef<HTMLDivElement>(null)
            const { scrollXProgress, scrollYProgress } = useScroll({
                target,
                offset: ["start end", "end start"],
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
})
