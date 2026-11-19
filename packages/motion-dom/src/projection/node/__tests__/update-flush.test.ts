import { frame, frameData } from "../../../frameloop"
import { createTestNode, TestRootNode } from "./TestProjectionNode"
import { nextFrame, nextMicrotask } from "./utils"

describe("the frame flush at the end of a tree update", () => {
    const createNode = () => {
        const node = createTestNode(new TestRootNode())
        node.mount({
            box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
        })
        return node
    }

    test("runs what's scheduled to update and render, without waiting for a frame", async () => {
        const node = createNode()
        const order: string[] = []
        frame.read(() => order.push("read"))
        frame.update(() => order.push("update"))
        frame.preRender(() => order.push("preRender"))
        frame.render(() => order.push("render"))
        frame.postRender(() => order.push("postRender"))

        node.willUpdate()
        node.root!.didUpdate()
        await nextMicrotask()

        expect(order).toEqual(["update", "preRender", "render"])
        expect(frameData.isProcessing).toBe(false)

        await nextFrame()
        expect(order).toEqual([
            "update",
            "preRender",
            "render",
            "read",
            "postRender",
        ])
    })

    test("ends a frame that was left processing", async () => {
        const node = createNode()
        await nextFrame()

        /**
         * What a frame callback that throws leaves behind. Nothing
         * scheduled while this is set requests a frame.
         */
        frameData.isProcessing = true

        node.willUpdate()
        node.root!.didUpdate()
        await nextMicrotask()

        expect(frameData.isProcessing).toBe(false)

        const render = jest.fn()
        frame.render(render)
        await nextFrame()
        expect(render).toHaveBeenCalledTimes(1)
    })
})
