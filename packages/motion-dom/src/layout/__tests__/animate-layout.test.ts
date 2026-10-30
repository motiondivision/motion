import { animateLayout, flushLayoutSnapshots } from "../.."
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
