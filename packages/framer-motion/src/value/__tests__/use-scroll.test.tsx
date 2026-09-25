import { supportsFlags } from "motion-dom"
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
        expect(transformAccelerate.ease).toHaveLength(2)
    })
})
