import { visualElementStore } from "motion-dom"
import { act, memo } from "react"
import { render } from "../../jest.setup"
import { featureLoaders } from "../../render/components/motion-async/loaders"
import { motion } from "../../render/components/motion-async/proxy"

/**
 * Let pending import()s resolve and the components render again.
 */
const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

const projectionOf = (element: Element) =>
    visualElementStore.get(element)!.projection

describe("the projection tree when layout is fetched", () => {
    test("every mounted component joins it, parents first", async () => {
        const Middle = memo(() => (
            <motion.div id="middle">
                <motion.div id="child" layout />
            </motion.div>
        ))

        const Component = ({ layout }: { layout?: boolean }) => (
            <motion.div id="parent" layout={layout}>
                <Middle />
            </motion.div>
        )

        const { container, rerender } = render(<Component />)
        const get = (id: string) => container.querySelector("#" + id)!
        await settle()

        expect(featureLoaders.layout.isLoaded).toBe(true)

        /**
         * A component with no layout props, in a memoised subtree, has a
         * node too, as it does when the feature is there from the start.
         */
        const parent = projectionOf(get("parent"))
        const middle = projectionOf(get("middle"))
        const child = projectionOf(get("child"))

        expect(parent).toBeTruthy()
        expect(middle).toBeTruthy()
        expect(middle.parent).toBe(parent)
        expect(child.parent).toBe(middle)
        expect(child.path).toEqual([parent.root, parent, middle])
        expect(child.instance).toBe(get("child"))

        rerender(<Component layout />)
        expect(projectionOf(get("child")).parent).toBe(middle)
    })
})
