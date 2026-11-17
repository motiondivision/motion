import { frame } from "../../../frameloop"
import { MultiValueAnimation } from "../../MultiValueAnimation"
import { animateElement } from "../element"

const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        await new Promise<void>((resolve) => frame.postRender(() => resolve()))
    }
}

/**
 * Count the frames each shared animation runs.
 */
function countTicks() {
    const ticks = new Map<MultiValueAnimation, number>()
    const { tick } = MultiValueAnimation.prototype
    jest.spyOn(MultiValueAnimation.prototype, "tick").mockImplementation(
        function (this: MultiValueAnimation, timestamp: number) {
            ticks.set(this, (ticks.get(this) || 0) + 1)
            return tick.call(this, timestamp)
        }
    )
    return ticks
}

const transition = { duration: 10, ease: "linear" } as const

describe("a shared animation whose values are all interrupted", () => {
    afterEach(() => jest.restoreAllMocks())

    it("stops running", async () => {
        const ticks = countTicks()
        const element = document.createElement("div")

        animateElement(
            element,
            { width: [0, 100], height: [0, 100] },
            transition
        )
        await frames(3)
        const [first] = ticks.keys()

        const second = animateElement(
            element,
            { width: 50, height: 50 },
            transition
        )
        await frames(2)
        const count = ticks.get(first)

        await frames(10)
        expect(ticks.get(first)).toBe(count)
        expect(first.state).toBe("idle")
        second.forEach((animation) => animation.stop())
    })

    it("stops running when paused", async () => {
        const ticks = countTicks()
        const element = document.createElement("div")

        const [animation] = animateElement(
            element,
            { width: [0, 100], height: [0, 100] },
            transition
        )
        await frames(3)
        const [first] = ticks.keys()
        animation.pause()
        await frames(2)

        const second = animateElement(
            element,
            { width: 50, height: 50 },
            transition
        )
        await frames(2)
        const count = ticks.get(first)

        await frames(10)
        expect(ticks.get(first)).toBe(count)
        expect(first.state).toBe("idle")
        second.forEach((animation) => animation.stop())
    })

    it("stops running when its other values have finished", async () => {
        const ticks = countTicks()
        const element = document.createElement("div")

        animateElement(
            element,
            { width: [0, 100], height: [0, 100] },
            { ...transition, width: { duration: 0.02 } }
        )
        await new Promise((resolve) => setTimeout(resolve, 100))
        await frames(2)
        const [first] = ticks.keys()
        expect(element.style.width).toBe("100px")

        const second = animateElement(element, { height: 50 }, transition)
        await frames(2)
        const count = ticks.get(first)

        await frames(10)
        expect(ticks.get(first)).toBe(count)
        expect(first.state).toBe("finished")
        second.forEach((animation) => animation.stop())
    })
})
