import { act, useState } from "react"
import { stepFrames, withManualFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * While a layout animation runs, every node it moves gets
 * will-change: transform, so it moves as a compositor layer instead of
 * repainting, and loses it when the animation ends. Past a budget of such
 * nodes, the layers cost more than the repaints they save, so none get one.
 *
 * JSDOM has no layout, so getBoundingClientRect is mocked from a data
 * attribute.
 */
function box(left: number, width: number) {
    return {
        x: left,
        y: 0,
        top: 0,
        left,
        width,
        height: 100,
        right: left + width,
        bottom: 100,
        toJSON() {},
    } as DOMRect
}

const frames = (count: number) => stepFrames((count * 1000) / 60)

const transition = {
    layout: { type: "tween" as const, ease: "linear" as const, duration: 1 },
}

let toggle: VoidFunction

function Cards({ count, willChange }: { count: number; willChange?: string }) {
    const [moved, setMoved] = useState(false)
    toggle = () => setMoved((value) => !value)
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <motion.div
                    key={i}
                    className="card"
                    layout
                    layoutDependency={moved}
                    transition={transition}
                    data-moved={moved}
                    style={{ willChange }}
                >
                    <motion.div
                        className="child"
                        layout
                        layoutDependency={moved}
                        transition={transition}
                        data-moved={moved}
                        data-scale={moved}
                    />
                </motion.div>
            ))}
        </>
    )
}

describe("layer budget", () => {
    withManualFrames()

    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            if (this.dataset.scale !== undefined) {
                return this.dataset.moved === "true"
                    ? box(260, 50)
                    : box(10, 20)
            }
            return this.dataset.moved === "true" ? box(200, 200) : box(0, 100)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    const elements = () =>
        Array.from(document.querySelectorAll<HTMLElement>(".card, .child"))

    async function animate(count: number, willChange?: string) {
        render(<Cards count={count} willChange={willChange} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        return elements()
    }

    test("every node in a small layout animation gets will-change", async () => {
        const nodes = await animate(3)
        expect(nodes).toHaveLength(6)
        for (const { style } of nodes) {
            expect(style.willChange).toBe("transform")
            expect(style.transform).toContain("translate(")
            expect(style.transform).not.toContain("translate3d(")
        }
    })

    test("will-change is removed when the animation ends", async () => {
        await animate(3)
        await frames(70)
        for (const { style } of elements()) {
            expect(style.transform).toBe("none")
            expect(style.willChange).toBe("")
        }
    })

    test("past the budget, no node gets will-change", async () => {
        const nodes = await animate(60)
        expect(nodes).toHaveLength(120)
        for (const { style } of nodes) {
            expect(style.willChange).toBe("")
            expect(style.transform).toContain("translate(")
            expect(style.transform).not.toContain("translate3d(")
        }
    })

    test("a will-change set in style is left alone", async () => {
        await animate(3, "opacity")
        const cards = document.querySelectorAll<HTMLElement>(".card")
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
        await frames(70)
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
    })
})
