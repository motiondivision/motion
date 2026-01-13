import { createTestNode } from "./TestProjectionNode"
import { nodeGroup } from "../group"

describe("nodeGroup", () => {
    test.skip("it notifies grouped nodes when any one of them will update", () => {
        const a = createTestNode()

        a.mount({})
        const b = createTestNode()
        b.mount({})

        const bLayoutUpdate = jest.fn()
        b.addEventListener("didUpdate", bLayoutUpdate)

        const group = nodeGroup()
        group.add(a)
        group.add(b)

        a.willUpdate()
        a.root.didUpdate()

        expect(bLayoutUpdate).toBeCalledTimes(1)
    })
})
