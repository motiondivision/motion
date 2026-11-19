import type { IProjectionNode, ProjectionNodeOptions } from "../types"
import { createTestNode, TestRootNode } from "./TestProjectionNode"
import { nextFrame } from "./utils"

describe("which nodes a tree walks", () => {
    const box = () => ({ x: { min: 0, max: 100 }, y: { min: 0, max: 100 } })

    const createNode = (parent: any, options?: ProjectionNodeOptions) =>
        createTestNode(parent, options) as unknown as IProjectionNode

    const mount = (parent: any, options?: ProjectionNodeOptions) => {
        const node = createNode(parent, options)
        node.mount({ box: box() })
        return node
    }

    const createRoot = () => {
        const root = new TestRootNode() as unknown as IProjectionNode
        root.mount({})
        return root
    }

    /**
     * Ids rather than nodes, which are too large for Jest to print.
     */
    const ids = (...nodes: IProjectionNode[]) => nodes.map((node) => node.id)

    const walked = (root: IProjectionNode) => {
        const nodes: IProjectionNode[] = []
        root.nodes!.forEach((node) => nodes.push(node as IProjectionNode))
        return ids(...nodes)
    }

    test("not a node with no part in layout", () => {
        const root = createRoot()
        const parent = mount(root)
        mount(parent)
        mount(parent, { layoutScroll: true })

        expect(walked(root)).toEqual(ids(root))
    })

    test.each<ProjectionNodeOptions>([
        { layout: true },
        { layout: "position" },
        { layoutId: "a" },
        { alwaysMeasureLayout: true },
    ])("a node with %p, and its ancestors", (options) => {
        const root = createRoot()
        const grandparent = mount(root)
        const parent = mount(grandparent)
        mount(grandparent)
        const node = mount(parent, options)
        mount(node)

        expect(walked(root)).toEqual(ids(root, grandparent, parent, node))
    })

    test("a node whose component has onBeforeLayoutMeasure, which every update calls", async () => {
        const onBeforeLayoutMeasure = jest.fn()
        const visualElement = {
            current: {},
            latestValues: {},
            getProps: () => ({ onBeforeLayoutMeasure }),
            notify: (name: string) =>
                name === "BeforeLayoutMeasure" && onBeforeLayoutMeasure(),
        } as any

        const root = createRoot()
        const node = mount(root, { visualElement })
        const other = mount(root, { layout: true })
        expect(walked(root)).toEqual(ids(root, node, other))

        other.willUpdate()
        root.didUpdate()
        await nextFrame()
        expect(onBeforeLayoutMeasure).toHaveBeenCalledTimes(1)
    })

    test("ancestors that mount after the node, as React's do", () => {
        const root = createRoot()
        const grandparent = createNode(root)
        const parent = createNode(grandparent)
        const node = createNode(parent, { layout: true })

        node.mount({ box: box() })
        expect(walked(root)).toEqual(ids(root, node))

        parent.mount({ box: box() })
        grandparent.mount({ box: box() })
        expect(walked(root)).toEqual(ids(root, grandparent, parent, node))
    })

    test("a node from when it's given a layout option", () => {
        const root = createRoot()
        const parent = mount(root)
        const node = mount(parent)
        expect(walked(root)).toEqual(ids(root))

        node.setOptions({ layout: true })
        expect(walked(root)).toEqual(ids(root, parent, node))

        node.setOptions({ layout: false })
        expect(walked(root)).toEqual(ids(root, parent, node))
    })

    test("a node from when it's told its layout will update", async () => {
        const root = createRoot()
        const parent = mount(root)
        const node = mount(parent)

        node.willUpdate()
        expect(walked(root)).toEqual(ids(root, parent, node))

        /**
         * Its layout is dirty, so the update measures it and leaves it clean.
         */
        expect(node.isLayoutDirty).toBe(true)
        root.didUpdate()
        await nextFrame()
        expect(node.isLayoutDirty).toBe(false)
        expect(node.layout).toBeTruthy()
    })

    test("a node that joins once an update has started has its rotation reset, as the update's start does for the rest", () => {
        const rendered: number[] = []
        const latestValues: Record<string, number> = { rotate: 45 }
        const visualElement = {
            current: {},
            latestValues,
            getProps: () => ({}),
            notify: () => {},
            setStaticValue: (key: string, value: number) =>
                (latestValues[key] = value),
            render: () => rendered.push(latestValues.rotate),
            scheduleRender: () => {},
        } as any

        const root = createRoot()
        const first = mount(root, { layout: true })
        const parent = mount(root)
        const node = mount(parent, { visualElement })

        first.willUpdate()
        expect(rendered).toEqual([])

        /**
         * Rendered without its rotation, which is then put back for the
         * next frame's render.
         */
        node.willUpdate()
        expect(walked(root)).toEqual(ids(root, first, parent, node))
        expect(rendered).toEqual([0])
        expect(latestValues.rotate).toBe(45)

        node.willUpdate()
        expect(rendered).toEqual([0])
    })

    test("not a node with no part in layout that unmounts and mounts again", () => {
        const root = createRoot()
        const parent = mount(root)
        const node = mount(parent)

        node.unmount()
        node.mount({ box: box() })
        expect(walked(root)).toEqual(ids(root))

        node.setOptions({ layout: true })
        expect(walked(root)).toEqual(ids(root, parent, node))
    })

    test("a node until it unmounts, and again when it mounts", () => {
        const root = createRoot()
        const parent = mount(root)
        const node = mount(parent, { layout: true })

        node.unmount()
        expect(walked(root)).toEqual(ids(root, parent))

        parent.unmount()
        expect(walked(root)).toEqual(ids(root))

        parent.mount({ box: box() })
        node.mount({ box: box() })
        expect(walked(root)).toEqual(ids(root, parent, node))
    })
})
