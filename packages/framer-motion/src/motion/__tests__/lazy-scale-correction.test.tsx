import {
    addScaleCorrector,
    scaleCorrectors,
    visualElementStore,
} from "motion-dom"
import { act } from "react"
import { LazyMotion, domMax, m } from "../.."
import { nextFrame } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

describe("Lazy layout scale correction", () => {
    test("Hands scale-corrected styles to projection after async domMax loads", async () => {
        /**
         * In a split production bundle the default correctors are registered
         * by the lazily-loaded projection chunk, so the first render sees an
         * empty registry.
         */
        const defaults = { ...scaleCorrectors }
        for (const key in scaleCorrectors) delete scaleCorrectors[key]

        try {
            let load!: () => void
            const features = new Promise<typeof domMax>((resolve) => {
                load = () => {
                    addScaleCorrector(defaults)
                    resolve(domMax)
                }
            })
            const boxShadow = "10px 10px 20px 0px rgba(0, 0, 0, 1)"

            const { container } = render(
                <LazyMotion features={() => features}>
                    <m.div layout style={{ borderRadius: 20, boxShadow }} />
                </LazyMotion>
            )
            const element = container.firstChild as HTMLElement

            expect(scaleCorrectors.borderRadius).toBeUndefined()
            expect(element.style.borderRadius).toBe("20px")

            await act(async () => {
                load()
                await features
            })
            await nextFrame()

            const visualElement = visualElementStore.get(element)!
            expect(visualElement.projection).toBeDefined()
            expect(visualElement.getValue("borderRadius")?.get()).toBe(20)
            expect(visualElement.getValue("boxShadow")?.get()).toBe(boxShadow)
            expect(element.style.borderRadius).toBe("20px")
            expect(element.style.boxShadow).toBe(boxShadow)
        } finally {
            addScaleCorrector(defaults)
        }
    })
})
