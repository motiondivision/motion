import { supportsFlags } from "motion-dom"
import { useRef } from "react"
import { render } from "../../jest.setup"
import { useScroll } from "../use-scroll"
import { useTransform } from "../use-transform"

describe("useScroll accelerate", () => {
    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
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

    test("does not set accelerate when target ref is provided", () => {
        supportsFlags.scrollTimeline = true

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
