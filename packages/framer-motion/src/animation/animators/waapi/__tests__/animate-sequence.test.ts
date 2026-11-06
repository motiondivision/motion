import "../../../../jest.setup"
import { animateSequence } from "../animate-sequence"
import "./setup"

describe("animateSequence (mini)", () => {
    test("reads every element's keyframes before starting any animation", () => {
        const elements = Array.from({ length: 3 }, () =>
            document.body.appendChild(document.createElement("div"))
        )

        const calls: string[] = []
        const getComputedStyle = window.getComputedStyle
        const read = jest
            .spyOn(window, "getComputedStyle")
            .mockImplementation((element) => {
                calls.push("read")
                return getComputedStyle(element)
            })
        const animate = Element.prototype.animate as jest.Mock
        const start = animate.getMockImplementation()!
        animate.mockImplementation(function (this: Element, ...args) {
            calls.push("animate")
            return start.apply(this, args)
        })

        animateSequence(
            elements.map((element, i) => [
                element,
                { opacity: 0.5 },
                { duration: 1, at: i * 0.1 },
            ])
        )

        /**
         * Reading after a write forces a style recalc, so reads and
         * writes alternating per element is much slower.
         */
        expect(calls).toEqual([
            "read",
            "read",
            "read",
            "animate",
            "animate",
            "animate",
        ])

        read.mockRestore()
        elements.forEach((element) => element.remove())
    })

    test("animates each element over the whole sequence", () => {
        const elements = Array.from({ length: 2 }, () =>
            document.createElement("div")
        )

        const animation = animateSequence([
            [elements[0], { opacity: [0, 1] }, { duration: 1 }],
            [elements[1], { opacity: [0, 1] }, { duration: 1, at: 0.5 }],
        ])

        const animate = Element.prototype.animate as jest.Mock
        expect(animate).toHaveBeenCalledTimes(2)
        expect(animate.mock.instances[0]).toBe(elements[0])
        expect(animate.mock.instances[1]).toBe(elements[1])
        expect(animate.mock.calls[1][0].offset).toEqual([0, 1 / 3, 1])
        expect(animate.mock.calls[1][1].duration).toBe(1500)
        expect(animation).toBeDefined()
    })
})
