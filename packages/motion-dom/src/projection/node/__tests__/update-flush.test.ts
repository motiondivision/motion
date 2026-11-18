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

    test("leaves a frame that's already processing to finish in order", async () => {
        const node = createNode()
        const order: string[] = []
        let delta: number | undefined
        let state: unknown[] = []

        await nextFrame()

        frame.update(() => {
            delta = frameData.delta
            frame.preRender(() => order.push("preRender"))
            frame.render(() => order.push("render"))

            node.willUpdate()
            ;(node.root as any).update()

            state = [frameData.isProcessing, frameData.delta]
            order.push("update")
        })

        await nextFrame()

        expect(state).toEqual([true, delta])
        expect(order).toEqual(["update", "preRender", "render"])
    })
})
