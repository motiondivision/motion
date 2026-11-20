import { visualElementStore } from "motion-dom"
import { act } from "react"
import * as Reorder from "../../components/Reorder/async-namespace"
import { render } from "../../jest.setup"
import { featureLoaders } from "../../render/components/motion-async/loaders"
import { motion } from "../../render/components/motion-async/proxy"

const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

const projectionOf = (element: Element) =>
    visualElementStore.get(element)!.projection

describe("Reorder with async layout and drag", () => {
    test("items join the projection tree of the components around them", async () => {
        const { container } = render(
            <motion.div id="parent" layout>
                <motion.div id="plain">
                    <Reorder.Group id="group" values={[0, 1]} onReorder={() => {}}>
                        <Reorder.Item id="a" value={0} />
                        <Reorder.Item id="b" value={1} />
                    </Reorder.Group>
                </motion.div>
            </motion.div>
        )
        const get = (id: string) => container.querySelector("#" + id)!
        await settle()

        expect(featureLoaders.layout.isLoaded).toBe(true)
        expect(featureLoaders.drag.isLoaded).toBe(true)

        const parent = projectionOf(get("parent"))
        const plain = projectionOf(get("plain"))
        const group = projectionOf(get("group"))

        expect(plain.parent).toBe(parent)
        expect(group.parent).toBe(plain)
        expect(projectionOf(get("a")).parent).toBe(group)
        expect(projectionOf(get("b")).path).toEqual([
            parent.root,
            parent,
            plain,
            group,
        ])
        expect(
            visualElementStore.get(get("a"))!.features.drag
        ).toBeTruthy()
    })
})
