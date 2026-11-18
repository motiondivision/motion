import {
    acquireProjectionNode,
    animateLayout,
    flushLayoutSnapshots,
} from "../.."
import { LayoutAnimationBuilder } from "../LayoutAnimationBuilder"

describe("animateLayout", () => {
    test("is exported and runs the DOM update", async () => {
        const element = document.createElement("div")
        element.setAttribute("data-layout", "")
        document.body.appendChild(element)

        const updateDom = jest.fn(() => {
            element.style.width = "100px"
        })

        const builder = animateLayout(updateDom, { duration: 0.1 })
        expect(builder).toBeInstanceOf(LayoutAnimationBuilder)

        const animation = await builder
        expect(updateDom).toHaveBeenCalledTimes(1)
        expect(element.style.width).toBe("100px")
        expect(typeof animation.stop).toBe("function")

        element.remove()
    })

    test("accepts a scope", async () => {
        const scope = document.createElement("div")
        document.body.appendChild(scope)

        const updateDom = jest.fn()
        await animateLayout(scope, updateDom)
        expect(updateDom).toHaveBeenCalledTimes(1)

        scope.remove()
    })

    test("doesn't compare document positions for a single call", async () => {
        /**
         * One call collects its elements in document order already. A
         * comparison between two siblings walks their sibling list, so
         * sorting a long flat list this way takes quadratic time.
         */
        const scope = document.createElement("div")
        for (let i = 0; i < 20; i++) {
            const element = document.createElement("div")
            element.setAttribute("data-layout", "")
            scope.appendChild(element)
        }
        document.body.appendChild(scope)

        // JSDOM's own querySelectorAll also compares, so count our calls.
        let calls = 0
        const original = Node.prototype.compareDocumentPosition
        const compare = jest
            .spyOn(Node.prototype, "compareDocumentPosition")
            .mockImplementation(function (this: Node, other: Node) {
                if (!new Error().stack!.includes("querySelectorAll")) {
                    calls++
                }
                return original.call(this, other)
            })

        await animateLayout(scope, () => {}, { duration: 0.1 })
        expect(calls).toBe(0)

        compare.mockRestore()
        scope.remove()
    })

    test("mounts ancestors first across calls made in the same tick", async () => {
        const parent = document.createElement("div")
        parent.setAttribute("data-layout", "")
        const child = document.createElement("div")
        child.setAttribute("data-layout", "")
        parent.appendChild(child)
        document.body.appendChild(parent)

        // The child's call comes first, so the parent is discovered second.
        const childBuilder = animateLayout(child, () => {}, { duration: 0.1 })
        const parentBuilder = animateLayout(parent, () => {}, {
            duration: 0.1,
        })
        await Promise.all([childBuilder, parentBuilder])

        const [childNode, release] = acquireProjectionNode(child)
        expect(childNode.parent?.instance).toBe(parent)

        release()
        parent.remove()
    })

    test("flushLayoutSnapshots runs the DOM update synchronously", async () => {
        const updateDom = jest.fn()
        const builder = animateLayout(updateDom)

        flushLayoutSnapshots()
        expect(updateDom).toHaveBeenCalledTimes(1)

        // The flush queued for the next microtask has nothing left to do.
        await builder
        expect(updateDom).toHaveBeenCalledTimes(1)
    })
})
