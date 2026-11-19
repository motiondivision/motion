import { createTestNode } from "./TestProjectionNode"
import { propagateDirtyNodes, cleanDirtyNodes } from "../create-projection-node"
import type { IProjectionNode } from "../types"
import { nextFrame, nextMicrotask } from "./utils"

describe("node", () => {
    test("If a child updates layout, and parent has scale, parent resetsTransform during measurement", async () => {
        const parent = createTestNode(undefined, {}, { scale: 2 })

        const parentInstance = {
            id: "parent",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        parent.mount(parentInstance)
        parent.addEventListener("didUpdate", ({ delta }: any) =>
            parent.setTargetDelta(delta)
        )

        const child = createTestNode(parent)
        const childInstance = {
            id: "child",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 50 },
                y: { min: 0, max: 50 },
            },
        }
        child.mount(childInstance)
        child.addEventListener("didUpdate", ({ delta }: any) => {
            child.setTargetDelta(delta)
        })

        parent.willUpdate()
        child.willUpdate()

        parentInstance.box = {
            x: { min: 100, max: 200 },
            y: { min: 100, max: 200 },
        }

        childInstance.box = {
            x: { min: 150, max: 200 },
            y: { min: 150, max: 200 },
        }

        child.root.didUpdate()

        await nextFrame()

        expect(parentInstance.resetTransform).toBeCalledTimes(1)
        expect(childInstance.resetTransform).toBeCalledTimes(0)

        child.willUpdate()

        childInstance.box = {
            x: { min: 0, max: 150 },
            y: { min: 0, max: 150 },
        }

        child.root.didUpdate()

        await nextFrame()
        await nextMicrotask()

        expect(parentInstance.resetTransform).toBeCalledTimes(2)
        expect(childInstance.resetTransform).toBeCalledTimes(0)
    })

    test("If a child updates layout, parent doesn't resetsTransform during measurement if it has no projection transform", async () => {
        const parent = createTestNode()

        const parentInstance = {
            id: "parent",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        parent.mount(parentInstance)
        parent.addEventListener("didUpdate", ({ delta }: any) =>
            parent.setTargetDelta(delta)
        )

        const child = createTestNode(parent)
        const childInstance = {
            id: "child",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 50 },
                y: { min: 0, max: 50 },
            },
        }
        child.mount(childInstance)
        child.addEventListener("didUpdate", ({ delta }: any) => {
            child.setTargetDelta(delta)
        })

        parent.willUpdate()
        child.willUpdate()

        childInstance.box = {
            x: { min: 150, max: 200 },
            y: { min: 150, max: 200 },
        }

        child.root.didUpdate()

        await nextFrame()

        // Shouldn't call on initial render as calculated deltas are zero
        expect(parentInstance.resetTransform).toBeCalledTimes(0)
        expect(childInstance.resetTransform).toBeCalledTimes(0)

        child.willUpdate()

        child.projectionDelta = {
            x: { translate: 100, scale: 1, originPoint: 60, origin: 0.4 },
            y: { translate: 0, scale: 1, originPoint: 60, origin: 0.4 },
        }

        childInstance.box = {
            x: { min: 0, max: 150 },
            y: { min: 0, max: 150 },
        }

        child.root.didUpdate()

        await nextFrame()

        expect(parentInstance.resetTransform).toBeCalledTimes(0)
        expect(childInstance.resetTransform).toBeCalledTimes(1)
    })

    test("Subtrees with updated targets propagate isProjectionDirty to children", async () => {
        const a = createTestNode(undefined, {})

        const aInstance = {
            id: "a",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 100 },
            },
        }
        a.mount(aInstance)

        const b = createTestNode(a)
        const bInstance = {
            id: "b",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 50 },
                y: { min: 0, max: 50 },
            },
        }
        b.mount(bInstance)

        const c = createTestNode(b)
        const cInstance = {
            id: "c",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 50 },
                y: { min: 0, max: 50 },
            },
        }
        c.mount(bInstance)

        const d = createTestNode(c)
        const dInstance = {
            id: "d",
            resetTransform: jest.fn(),
            box: {
                x: { min: 0, max: 50 },
                y: { min: 0, max: 50 },
            },
        }
        d.mount(dInstance)

        a.willUpdate()
        b.willUpdate()
        c.willUpdate()
        d.willUpdate()

        aInstance.box = {
            x: { min: 100, max: 200 },
            y: { min: 100, max: 200 },
        }

        bInstance.box = {
            x: { min: 150, max: 200 },
            y: { min: 150, max: 200 },
        }

        cInstance.box = {
            x: { min: 150, max: 200 },
            y: { min: 150, max: 200 },
        }

        dInstance.box = {
            x: { min: 100, max: 200 },
            y: { min: 100, max: 200 },
        }

        b.root.didUpdate()

        await nextFrame()

        b.setTargetDelta({
            x: { translate: 200, scale: 2, origin: 0.5, originPoint: 100 },
            y: { translate: 200, scale: 2, origin: 0.5, originPoint: 100 },
        })

        // This hacks c into being considered "projecting" and propagation should stop here
        c.relativeTarget = { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } }

        propagateDirtyNodes(a as IProjectionNode)
        propagateDirtyNodes(b as IProjectionNode)
        propagateDirtyNodes(c as IProjectionNode)
        propagateDirtyNodes(d as IProjectionNode)

        // Check isProjectionDirty is propagated from child to grandChild
        expect(a.isProjectionDirty).toEqual(false)
        expect(a.isSharedProjectionDirty).toEqual(false)
        expect(b.isProjectionDirty).toEqual(true)
        expect(b.isSharedProjectionDirty).toEqual(true)
        expect(c.isProjectionDirty).toEqual(false)
        expect(c.isSharedProjectionDirty).toEqual(true)
        expect(d.isProjectionDirty).toEqual(false)
        expect(d.isSharedProjectionDirty).toEqual(true)

        a.resolveTargetDelta()
        b.resolveTargetDelta()
        c.resolveTargetDelta()
        d.resolveTargetDelta()

        a.calcProjection()
        b.calcProjection()
        c.calcProjection()
        d.calcProjection()

        cleanDirtyNodes(a as IProjectionNode)
        cleanDirtyNodes(b as IProjectionNode)
        cleanDirtyNodes(c as IProjectionNode)
        cleanDirtyNodes(d as IProjectionNode)

        // Check isProjectionDirty is cleaned up after projections are calculated
        expect(
            a.isProjectionDirty ||
                a.isSharedProjectionDirty ||
                b.isProjectionDirty ||
                b.isSharedProjectionDirty ||
                c.isProjectionDirty ||
                c.isSharedProjectionDirty ||
                d.isProjectionDirty ||
                d.isSharedProjectionDirty
        ).toEqual(false)
    })

    test("Releases a layoutId's stack once its last member unmounts", async () => {
        const node = createTestNode(undefined, { layoutId: "released" })
        node.mount({})
        const { root } = node

        expect(root.sharedNodes.get("released")!.lead).toBe(node)

        node.unmount()
        node.scheduleCheckAfterUnmount()

        await nextFrame()
        await nextMicrotask()

        expect(root.sharedNodes.has("released")).toBe(false)
    })

    test("Keeps a layoutId's stack for a replacement mounted in the same commit", async () => {
        const prev = createTestNode(undefined, { layoutId: "swapped" })
        prev.mount({})
        const { root } = prev

        prev.unmount()
        prev.scheduleCheckAfterUnmount()

        const next = createTestNode(undefined, { layoutId: "swapped" })
        next.mount({})

        const stack = root.sharedNodes.get("swapped")!
        expect(stack.lead).toBe(next)
        expect(next.resumeFrom).toBe(prev)

        await nextFrame()
        await nextMicrotask()

        expect(root.sharedNodes.get("swapped")).toBe(stack)
        expect(stack.members).toEqual([next])
    })

    test("A node finds its layoutId's new stack once the old one is released", async () => {
        const node = createTestNode(undefined, { layoutId: "renewed" })
        node.mount({})
        const { root } = node
        const stack = node.getStack()
        expect(stack).toBe(root.sharedNodes.get("renewed"))

        node.unmount()
        node.scheduleCheckAfterUnmount()
        await nextFrame()
        await nextMicrotask()
        expect(node.getStack()).toBeUndefined()

        const next = createTestNode(undefined, { layoutId: "renewed" })
        next.mount({})
        const renewed = root.sharedNodes.get("renewed")
        expect(renewed).not.toBe(stack)
        expect(node.getStack()).toBe(renewed)
        expect(next.getStack()).toBe(renewed)

        /**
         * And a new layoutId's.
         */
        next.setOptions({ layoutId: "other" })
        expect(next.getStack()).toBe(root.sharedNodes.get("other"))

        root.resetTree()
        expect(next.getStack()).toBeUndefined()
    })

    /**
     * #2284: a shared layout animation must apply the lead's own transforms
     * (here `scale`) once, not twice.
     */
    test("Shared layout animation applies the node's own scale once", () => {
        const box = () => ({
            x: { min: 0, max: 100 },
            y: { min: 0, max: 100 },
        })
        const node = createTestNode(undefined, { layout: true }, { scale: 1.5 })
        node.mount({})

        const prev = createTestNode(undefined, { layout: true })
        prev.mount({})

        node.layout = {
            animationId: 0,
            measuredBox: box(),
            layoutBox: box(),
            latestValues: {},
            source: node.id,
        }
        node.layoutCorrected = box()
        node.resumingFrom = prev
        node.setTargetDelta({
            x: { translate: 0, scale: 1, origin: 0.5, originPoint: 50 },
            y: { translate: 0, scale: 1, origin: 0.5, originPoint: 50 },
        })

        node.resolveTargetDelta(true)
        node.calcProjection()
        node.applyTransformsToTarget()

        expect(node.projectionDeltaWithTransform!.x.scale).toBeCloseTo(1.5)
        expect(node.projectionDeltaWithTransform!.y.scale).toBeCloseTo(1.5)
        expect(node.target).toEqual(box())
    })
})

describe("setOptions", () => {
    test("keeps the options it isn't given", () => {
        const node = createTestNode(undefined, {
            layoutId: "a",
            crossfade: false,
        })

        node.setOptions({ alwaysMeasureLayout: true })

        expect(node.options).toMatchObject({
            layoutId: "a",
            crossfade: false,
            alwaysMeasureLayout: true,
        })
    })

    test("turns crossfade back on when it's given as undefined", () => {
        const node = createTestNode(undefined, {
            layoutId: "a",
            crossfade: false,
        })

        node.setOptions({ crossfade: undefined })

        expect(node.options.crossfade).not.toBe(false)
        expect(node.options.layoutId).toBe("a")
    })

    test("promoting a node with a transition keeps crossfade disabled", () => {
        const transition = { duration: 1 }
        const node = createTestNode(undefined, {
            layoutId: "promoted",
            crossfade: false,
            initialPromotionConfig: { transition },
        })

        node.mount({
            box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
        })

        expect(node.isLead()).toBe(true)
        expect(node.options.transition).toBe(transition)
        expect(node.options.crossfade).toBe(false)
    })
})
