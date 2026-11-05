import { calcBoxDelta } from "../../geometry/delta-calc"
import { createBox } from "../../geometry/models"
import { createTestNode } from "./TestProjectionNode"

/**
 * A style object that records every property written to it.
 */
function createStyle() {
    const writes: string[] = []
    const style = new Proxy({} as Record<string, unknown>, {
        set(target, key, value) {
            writes.push(key as string)
            target[key as string] = value
            return true
        },
    })
    return { style, writes }
}

function createProjectingNode(renderedStyle: Record<string, unknown> = {}) {
    const node = createTestNode(undefined, {
        layout: true,
        visualElement: {
            current: {},
            latestValues: {},
            measureViewportBox: () => createBox(),
            renderState: { style: renderedStyle },
            getProps: () => ({}),
        } as any,
    })
    node.mount({})

    const box = { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } }
    node.layout = {
        animationId: 0,
        measuredBox: box,
        layoutBox: box,
        latestValues: {},
        source: 0,
    }
    node.layoutCorrected = { x: { ...box.x }, y: { ...box.y } }
    node.target = { x: { min: 50, max: 150 }, y: { min: 0, max: 100 } }
    node.targetWithTransforms = createBox()
    node.createProjectionDeltas()
    calcBoxDelta(node.projectionDelta!, node.layoutCorrected, node.target)

    return node
}

describe("applyProjectionStyles", () => {
    test("Only writes the transform when the other styles haven't changed", () => {
        const node = createProjectingNode()
        const { style, writes } = createStyle()

        node.applyProjectionStyles(style)
        expect(writes).toEqual([
            "visibility",
            "transform",
            "transformOrigin",
            "opacity",
        ])
        expect(style).toEqual({
            visibility: "",
            transform: "translate3d(50px, 0px, 0px) ",
            transformOrigin: "50% 50% 0",
            opacity: "",
        })

        writes.length = 0
        node.applyProjectionStyles(style)
        expect(writes).toEqual(["transform"])
    })

    test("Writes a style again if the element's render wrote it", () => {
        const node = createProjectingNode({ opacity: 0.5 })
        const { style, writes } = createStyle()

        node.applyProjectionStyles(style)
        writes.length = 0
        node.applyProjectionStyles(style)
        expect(writes).toEqual(["transform", "opacity"])
        expect(style.opacity).toBe("")
    })

    test("Writes every style again after a new style prop", () => {
        const node = createProjectingNode()
        const { style, writes } = createStyle()

        const styleProp = { opacity: 1 }
        node.applyProjectionStyles(style, styleProp)
        writes.length = 0
        node.applyProjectionStyles(style, styleProp)
        expect(writes).toEqual(["transform"])

        node.applyProjectionStyles(style, { opacity: 0.5 })
        expect(writes).toEqual([
            "transform",
            "visibility",
            "transform",
            "transformOrigin",
            "opacity",
        ])
    })

    test("Writes every style again after the layout updates", () => {
        const node = createProjectingNode()
        const { style, writes } = createStyle()

        node.applyProjectionStyles(style)
        node.willUpdate()
        writes.length = 0
        node.applyProjectionStyles(style)
        expect(writes).toEqual([
            "visibility",
            "transform",
            "transformOrigin",
            "opacity",
        ])
    })

    test("Writes visibility when the node is hidden, then shown", () => {
        const node = createProjectingNode()
        const { style } = createStyle()

        node.applyProjectionStyles(style)
        expect(style.visibility).toBe("")

        node.isVisible = false
        node.getLead = () => ({} as any)
        node.applyProjectionStyles(style)
        expect(style.visibility).toBe("hidden")

        node.isVisible = true
        node.getLead = () => node
        node.applyProjectionStyles(style)
        expect(style.visibility).toBe("")
    })
})
