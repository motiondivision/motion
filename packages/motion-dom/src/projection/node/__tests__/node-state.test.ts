import { createTestNode, TestRootNode } from "./TestProjectionNode"
import { nextFrame } from "./utils"

describe("per-node state", () => {
    const box = () => ({ x: { min: 0, max: 100 }, y: { min: 0, max: 100 } })

    /**
     * A node in a tree of its own, so no test leaves state on a root
     * that another one reads.
     */
    const createNode = (parent: any = new TestRootNode()) => {
        const node = createTestNode(parent)
        node.mount({ box: box() })
        return node
    }

    test("only the root holds what only the root uses", () => {
        const parent = createNode()
        const child = createNode(parent)

        const root = child.root as any
        expect(root).not.toBe(parent)
        expect(root.sharedNodes).toBeInstanceOf(Map)
        expect(root.scheduleUpdate).toBeInstanceOf(Function)
        expect(root.hasOwnProperty("updateProjection")).toBe(true)

        for (const node of [parent, child] as any[]) {
            expect(node.sharedNodes).toBeUndefined()
            expect(node.scheduleUpdate).toBeUndefined()
            expect(node.hasOwnProperty("updateProjection")).toBe(false)
        }
    })

    test("a node has no event handlers until a listener is added", () => {
        const node = createNode() as any

        expect(node.eventHandlers).toBeUndefined()
        expect(node.hasListeners("didUpdate")).toBe(false)
        expect(() => node.notifyListeners("didUpdate")).not.toThrow()
        expect(node.eventHandlers).toBeUndefined()
    })

    test("listeners are notified until they're removed or the node unmounts", () => {
        const node = createNode()

        const onUpdate = jest.fn()
        const onComplete = jest.fn()
        const stopUpdate = node.addEventListener("didUpdate", onUpdate)
        node.addEventListener("animationComplete", onComplete)

        expect(node.hasListeners("didUpdate")).toBe(true)
        expect(node.hasListeners("animationStart")).toBe(false)

        node.notifyListeners("didUpdate", 1, 2)
        expect(onUpdate.mock.calls[0].slice(0, 2)).toEqual([1, 2])
        expect(onComplete).not.toHaveBeenCalled()

        stopUpdate()
        node.notifyListeners("didUpdate")
        expect(onUpdate).toHaveBeenCalledTimes(1)

        node.unmount()
        expect(node.hasListeners("animationComplete")).toBe(false)
        node.notifyListeners("animationComplete")
        expect(onComplete).not.toHaveBeenCalled()

        node.mount({ box: box() })
        node.addEventListener("animationComplete", onComplete)
        node.notifyListeners("animationComplete")
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("the root clears a failed update a frame after a node asks it to", async () => {
        const node = createNode()
        const sibling = createNode(node.parent)
        const { root } = node

        node.willUpdate()
        expect(root!.isUpdating).toBe(true)

        /**
         * The sibling's layout isn't dirty, so it has the root check for
         * an update that never finished.
         */
        sibling.scheduleCheckAfterUnmount()
        expect(root!.isUpdating).toBe(true)

        await nextFrame()
        expect(root!.isUpdating).toBe(false)
    })

    test("the root updates projection a frame after a node schedules it", async () => {
        const node = createNode()
        const root = node.root as any

        node.setTargetDelta({
            x: { translate: 10, scale: 1, origin: 0, originPoint: 0 },
            y: { translate: 10, scale: 1, origin: 0, originPoint: 0 },
        })
        expect(root.projectionUpdateScheduled).toBe(true)
        expect(node.isProjectionDirty).toBe(true)

        await nextFrame()
        expect(root.projectionUpdateScheduled).toBe(false)
        expect(node.isProjectionDirty).toBe(false)
    })
})
