import {
    createDelta,
    getFeatureDefinitions,
    HTMLProjectionNode,
    motionValue,
    visualElementStore,
} from "motion-dom"
import { domLayout, domMax, LazyMotion, m } from "../../.."
import { pointerUp, render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"
import { drag, MockDrag } from "../../../gestures/drag/__tests__/utils"

describe("domLayout and domMax feature bundles", () => {
    afterEach(() => {
        pointerUp(document.body)
    })

    /**
     * Runs first: checks that domLayout loads layout projection without drag/pan.
     */
    test("domLayout enables layout projection without loading drag or pan", async () => {
        const x = motionValue(0)
        const onComplete = jest.fn()

        const { container } = render(
            <LazyMotion features={domLayout}>
                <m.div
                    id="layout-box"
                    layout
                    animate={{ x: 20 }}
                    transition={{ duration: 0.01 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            </LazyMotion>
        )

        const definitions = getFeatureDefinitions()
        expect(definitions.layout?.ProjectionNode).toBe(HTMLProjectionNode)
        expect(definitions.layout?.MeasureLayout).toBeDefined()
        expect(definitions.drag?.Feature).toBeUndefined()
        expect(definitions.pan?.Feature).toBeUndefined()

        const element = container.querySelector("#layout-box")!
        const visualElement = visualElementStore.get(element)!

        expect(visualElement.projection).toBeInstanceOf(HTMLProjectionNode)
        expect(visualElement.projection.instance).toBe(element)
        expect(visualElement.projection.options.layout).toBe(true)

        await new Promise((resolve) => setTimeout(resolve, 40))
        expect(x.get()).toBe(20)
        expect(onComplete).toHaveBeenCalled()
    })

    test("domMax uses full HTMLProjectionNode for drag + layout interaction", async () => {
        const x = motionValue(0)
        const y = motionValue(0)

        const { container, rerender } = render(
            <LazyMotion features={domMax}>
                <MockDrag>
                    <m.div id="both" drag="x" layout style={{ x, y }} />
                </MockDrag>
            </LazyMotion>
        )
        rerender(
            <LazyMotion features={domMax}>
                <MockDrag>
                    <m.div id="both" drag="x" layout style={{ x, y }} />
                </MockDrag>
            </LazyMotion>
        )
        await nextFrame()

        const element = container.querySelector("#both")!
        const visualElement = visualElementStore.get(element)!

        expect(visualElement.projection).toBeInstanceOf(HTMLProjectionNode)
        expect(visualElement.projection.isMeasureOnly).toBeUndefined()
        expect(visualElement.projection.options.alwaysMeasureLayout).toBe(true)

        const pointer = await drag(element).to(100, 0)
        expect(x.get()).toBe(100)

        const delta = createDelta()
        delta.x.translate = -50
        delta.y.translate = 50
        visualElement.projection.notifyListeners("didUpdate", {
            delta,
            hasLayoutChanged: true,
        })

        expect(x.get()).toBe(50)
        expect(y.get()).toBe(0)

        pointer.end()
    })
})
