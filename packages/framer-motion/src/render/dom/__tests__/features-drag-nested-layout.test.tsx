import { HTMLProjectionNode, visualElementStore } from "motion-dom"
import { domDrag, LazyMotion, m, motion } from "../../.."
import { render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"

/**
 * Kept in its own file: `motion` components load every feature globally,
 * which would leak into the other domDrag tests.
 */
describe("domDrag with a full motion layout child", () => {
    test("a motion.div layout child inside a domDrag draggable mounts", async () => {
        const Child = () => <motion.div id="child" layout />

        const { container } = render(
            <LazyMotion features={domDrag}>
                <m.div id="parent" drag>
                    <Child />
                </m.div>
            </LazyMotion>
        )
        await nextFrame()

        const child = visualElementStore.get(
            container.querySelector("#child")!
        )!
        expect(child.projection).toBeInstanceOf(HTMLProjectionNode)
        expect(child.projection!.isMeasureOnly).toBeFalsy()
        expect(child.projection!.parent?.isMeasureOnly).toBeFalsy()
    })
})
