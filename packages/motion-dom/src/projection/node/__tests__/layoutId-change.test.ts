import { createTestNode, TestRootNode } from "./TestProjectionNode"
import { nextFrame } from "./utils"

describe("layoutId changes", () => {
    test("When layoutId changes via setOptions, node is removed from old stack and added to new stack", () => {
        const root = new TestRootNode() as any
        const node = createTestNode(root, { layoutId: "original-id" })

        const instance = {
            id: "test",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        node.mount(instance)

        // Verify node is registered with original layoutId
        expect(root.sharedNodes.has("original-id")).toBe(true)
        expect(root.sharedNodes.get("original-id").members).toContain(node)

        // Change layoutId
        node.setOptions({ layoutId: "new-id" })

        // Verify node is no longer in old stack
        const oldStack = root.sharedNodes.get("original-id")
        expect(oldStack === undefined || !oldStack.members.includes(node)).toBe(
            true
        )

        // Verify node is in new stack
        expect(root.sharedNodes.has("new-id")).toBe(true)
        expect(root.sharedNodes.get("new-id").members).toContain(node)
    })

    test("When layoutId changes from undefined to a value, node is registered with new stack", () => {
        const root = new TestRootNode() as any
        const node = createTestNode(root, { layout: true })

        const instance = {
            id: "test",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        node.mount(instance)

        // Verify no shared node registered initially
        expect(root.sharedNodes.has("new-id")).toBe(false)

        // Add layoutId
        node.setOptions({ layoutId: "new-id" })

        // Verify node is now registered
        expect(root.sharedNodes.has("new-id")).toBe(true)
        expect(root.sharedNodes.get("new-id").members).toContain(node)
    })

    test("When layoutId changes from a value to undefined, node is removed from old stack", () => {
        const root = new TestRootNode() as any
        const node = createTestNode(root, { layoutId: "old-id" })

        const instance = {
            id: "test",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        node.mount(instance)

        // Verify node is registered initially
        expect(root.sharedNodes.has("old-id")).toBe(true)
        expect(root.sharedNodes.get("old-id").members).toContain(node)

        // Remove layoutId
        node.setOptions({ layoutId: undefined })

        // Verify node is no longer in old stack
        const oldStack = root.sharedNodes.get("old-id")
        expect(oldStack === undefined || !oldStack.members.includes(node)).toBe(
            true
        )
    })

    test("When layoutId stays the same, node remains in the same stack", () => {
        const root = new TestRootNode() as any
        const node = createTestNode(root, { layoutId: "same-id" })

        const instance = {
            id: "test",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        node.mount(instance)

        // Verify node is registered
        expect(root.sharedNodes.has("same-id")).toBe(true)
        const originalStack = root.sharedNodes.get("same-id")
        expect(originalStack.members).toContain(node)

        // Set same layoutId
        node.setOptions({ layoutId: "same-id" })

        // Verify node is still in the same stack
        expect(root.sharedNodes.get("same-id")).toBe(originalStack)
        expect(originalStack.members).toContain(node)
        // Verify node is only in the stack once
        expect(
            originalStack.members.filter((m: any) => m === node).length
        ).toBe(1)
    })

    test("Multiple nodes can share layoutId and promotion works correctly after layoutId change", async () => {
        const root = new TestRootNode() as any

        // First node with layoutId "shared"
        const nodeA = createTestNode(root, { layoutId: "shared" })
        const instanceA = {
            id: "nodeA",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        nodeA.mount(instanceA)

        // Second node with layoutId "shared"
        const nodeB = createTestNode(root, { layoutId: "shared" })
        const instanceB = {
            id: "nodeB",
            resetTransform: jest.fn(),
            box: {
                x: { min: 100, max: 200 },
                y: { min: 100, max: 200 },
            },
        }
        nodeB.mount(instanceB)

        // Verify both nodes share the same stack
        const stack = root.sharedNodes.get("shared")
        expect(stack.members).toContain(nodeA)
        expect(stack.members).toContain(nodeB)
        expect(stack.members.length).toBe(2)

        // Change nodeA's layoutId
        nodeA.setOptions({ layoutId: "different" })

        // Verify nodeA is now in a different stack
        expect(root.sharedNodes.get("different").members).toContain(nodeA)
        expect(root.sharedNodes.get("shared").members).not.toContain(nodeA)
        expect(root.sharedNodes.get("shared").members).toContain(nodeB)
    })

    test("getLead returns correct node after layoutId change", () => {
        const root = new TestRootNode() as any

        const nodeA = createTestNode(root, { layoutId: "test-id" })
        const instanceA = {
            id: "nodeA",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        nodeA.mount(instanceA)

        // nodeA should be lead
        expect(nodeA.isLead()).toBe(true)

        // Change layoutId
        nodeA.setOptions({ layoutId: "new-test-id" })

        // Should still be lead of the new stack
        expect(nodeA.isLead()).toBe(true)
        expect(nodeA.getLead()).toBe(nodeA)
    })

    test("getStack returns correct stack after layoutId change", () => {
        const root = new TestRootNode() as any

        const node = createTestNode(root, { layoutId: "first-id" })
        const instance = {
            id: "test",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        node.mount(instance)

        const firstStack = node.getStack()
        expect(firstStack).toBe(root.sharedNodes.get("first-id"))

        // Change layoutId
        node.setOptions({ layoutId: "second-id" })

        const secondStack = node.getStack()
        expect(secondStack).toBe(root.sharedNodes.get("second-id"))
        expect(secondStack).not.toBe(firstStack)
    })
})
