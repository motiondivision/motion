import { createTestNode } from "./TestProjectionNode"
import { createBox, createDelta } from "../../geometry/models"

/**
 * Helper to make a node "projecting" by setting targetDelta and layout.
 * A node is only projecting if it has (targetDelta || relativeTarget || layoutRoot) AND layout.
 */
function makeProjecting(node: any) {
    node.setTargetDelta(createDelta())
    node.layout = {
        animationId: 0,
        measuredBox: createBox(),
        layoutBox: createBox(),
        latestValues: {},
        source: node.id,
    }
}

describe("hardware acceleration eligibility", () => {
    describe("canUseHardwareAcceleration", () => {
        test("returns true for isolated nodes with no projecting parents or children", () => {
            const node = createTestNode(undefined, { layout: true })
            const instance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                },
            }
            node.mount(instance)

            // Node has no projecting parents or children
            expect(node.canUseHardwareAcceleration()).toBe(true)
        })

        test("returns false for nodes with projecting parent", () => {
            const parent = createTestNode(undefined, { layout: true })
            const parentInstance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                },
            }
            parent.mount(parentInstance)

            // Make parent projecting
            makeProjecting(parent)

            const child = createTestNode(parent, { layout: true })
            const childInstance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 50 },
                    y: { min: 0, max: 50 },
                },
            }
            child.mount(childInstance)

            // Child should not be eligible because parent is projecting
            expect(child.canUseHardwareAcceleration()).toBe(false)
        })

        test("returns false for nodes with projecting children", () => {
            const parent = createTestNode(undefined, { layout: true })
            const parentInstance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                },
            }
            parent.mount(parentInstance)

            const child = createTestNode(parent, { layout: true })
            const childInstance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 50 },
                    y: { min: 0, max: 50 },
                },
            }
            child.mount(childInstance)

            // Make child projecting
            makeProjecting(child)

            // Parent should not be eligible because child is projecting
            expect(parent.canUseHardwareAcceleration()).toBe(false)
        })

        test("returns false when resuming from another element", () => {
            const prevNode = createTestNode(undefined, { layout: true })
            const prevInstance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                },
            }
            prevNode.mount(prevInstance)

            const node = createTestNode(undefined, { layout: true })
            const instance = {
                resetTransform: jest.fn(),
                box: {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                },
            }
            node.mount(instance)

            // Simulate resuming from previous node
            node.resumeFrom = prevNode as any

            expect(node.canUseHardwareAcceleration()).toBe(false)
        })
    })

    describe("hasProjectingAncestor", () => {
        test("returns false when no ancestors are projecting", () => {
            const grandparent = createTestNode(undefined, { layout: true })
            grandparent.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            const parent = createTestNode(grandparent, { layout: true })
            parent.mount({
                box: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } },
            })

            const child = createTestNode(parent, { layout: true })
            child.mount({
                box: { x: { min: 0, max: 25 }, y: { min: 0, max: 25 } },
            })

            expect(child.hasProjectingAncestor()).toBe(false)
        })

        test("returns true when an ancestor is projecting", () => {
            const grandparent = createTestNode(undefined, { layout: true })
            grandparent.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })
            makeProjecting(grandparent)

            const parent = createTestNode(grandparent, { layout: true })
            parent.mount({
                box: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } },
            })

            const child = createTestNode(parent, { layout: true })
            child.mount({
                box: { x: { min: 0, max: 25 }, y: { min: 0, max: 25 } },
            })

            expect(child.hasProjectingAncestor()).toBe(true)
        })
    })

    describe("hasProjectingDescendant", () => {
        test("returns false when no descendants are projecting", () => {
            const parent = createTestNode(undefined, { layout: true })
            parent.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            const child = createTestNode(parent, { layout: true })
            child.mount({
                box: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } },
            })

            expect(parent.hasProjectingDescendant()).toBe(false)
        })

        test("returns true when a child is projecting", () => {
            const parent = createTestNode(undefined, { layout: true })
            parent.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            const child = createTestNode(parent, { layout: true })
            child.mount({
                box: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } },
            })
            makeProjecting(child)

            expect(parent.hasProjectingDescendant()).toBe(true)
        })

        test("returns true when a grandchild is projecting", () => {
            const grandparent = createTestNode(undefined, { layout: true })
            grandparent.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            const parent = createTestNode(grandparent, { layout: true })
            parent.mount({
                box: { x: { min: 0, max: 50 }, y: { min: 0, max: 50 } },
            })

            const child = createTestNode(parent, { layout: true })
            child.mount({
                box: { x: { min: 0, max: 25 }, y: { min: 0, max: 25 } },
            })
            makeProjecting(child)

            expect(grandparent.hasProjectingDescendant()).toBe(true)
        })
    })

    describe("buildLayoutAnimationTransform", () => {
        test("returns identity transform at progress 1", () => {
            const node = createTestNode(undefined, { layout: true })
            node.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            // Set animation delta
            node.animationDelta = {
                x: {
                    translate: 100,
                    scale: 0.5,
                    origin: 0.5,
                    originPoint: 50,
                },
                y: {
                    translate: 50,
                    scale: 2,
                    origin: 0.5,
                    originPoint: 50,
                },
            }

            const transform = node.buildLayoutAnimationTransform(1)

            // At progress 1, should be close to identity (no transform)
            // The transform should have translate ~0 and scale ~1
            expect(transform).toBe("none")
        })

        test("returns full delta transform at progress 0", () => {
            const node = createTestNode(undefined, { layout: true })
            node.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            // Set animation delta
            node.animationDelta = {
                x: {
                    translate: 100,
                    scale: 0.5,
                    origin: 0.5,
                    originPoint: 50,
                },
                y: {
                    translate: 50,
                    scale: 2,
                    origin: 0.5,
                    originPoint: 50,
                },
            }

            const transform = node.buildLayoutAnimationTransform(0)

            // At progress 0, should include the full delta
            expect(transform).toContain("translate3d(100px, 50px, 0px)")
            expect(transform).toContain("scale(0.5, 2)")
        })

        test("returns interpolated transform at progress 0.5", () => {
            const node = createTestNode(undefined, { layout: true })
            node.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            // Set animation delta
            node.animationDelta = {
                x: {
                    translate: 100,
                    scale: 0.5,
                    origin: 0.5,
                    originPoint: 50,
                },
                y: {
                    translate: 50,
                    scale: 1, // No scale change on y
                    origin: 0.5,
                    originPoint: 50,
                },
            }

            const transform = node.buildLayoutAnimationTransform(0.5)

            // At progress 0.5, translate should be half
            expect(transform).toContain("translate3d(50px, 25px, 0px)")
            // Scale should be interpolated: 0.5 + (1 - 0.5) * 0.5 = 0.75
            expect(transform).toContain("scale(0.75, 1)")
        })

        test("returns 'none' when no animation delta is set", () => {
            const node = createTestNode(undefined, { layout: true })
            node.mount({
                box: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
            })

            const transform = node.buildLayoutAnimationTransform(0.5)
            expect(transform).toBe("none")
        })
    })
})
