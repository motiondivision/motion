import { createTestNode } from "./TestProjectionNode"

describe("per-node state", () => {
    const box = () => ({ x: { min: 0, max: 100 }, y: { min: 0, max: 100 } })

    test("only the root holds what only the root uses", () => {
        const parent = createTestNode()
        parent.mount({ box: box() })
        const child = createTestNode(parent)
        child.mount({ box: box() })

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
        const node = createTestNode() as any
        node.mount({ box: box() })

        expect(node.eventHandlers).toBeUndefined()
        expect(node.hasListeners("didUpdate")).toBe(false)
        expect(() => node.notifyListeners("didUpdate")).not.toThrow()
        expect(node.eventHandlers).toBeUndefined()
    })

    test("listeners are notified until they're removed or the node unmounts", () => {
        const node = createTestNode()
        node.mount({ box: box() })

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

    test("a failed update is cleared from the root", () => {
        const node = createTestNode()
        node.mount({ box: box() })
        const { root } = node

        node.willUpdate()
        expect(root!.isUpdating).toBe(true)

        root!.checkUpdateFailed()
        expect(root!.isUpdating).toBe(false)
    })
})
