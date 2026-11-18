import { act, useState } from "react"
import { stepFrames, withManualFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * A layout node whose children also project writes translate3d, so its
 * subtree moves as a compositor layer instead of repainting. Past a budget
 * of such parents, the layers cost the GPU more than the repaints they
 * save, so every node writes translate() instead.
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
    layout: { type: "tween" as const, ease: "linear" as const, duration: 10 },
}

let toggle: VoidFunction

function Cards({ count }: { count: number }) {
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
                >
                    <motion.div
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

    async function transforms(count: number) {
        render(<Cards count={count} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        return Array.from(document.querySelectorAll<HTMLElement>(".card")).map(
            (card) => card.style.transform
        )
    }

    test("a few parents with projecting children each get a layer", async () => {
        const cards = await transforms(3)
        expect(cards).toHaveLength(3)
        for (const transform of cards) expect(transform).toContain("translate3d(")
    })

    test("past the budget, every parent moves with translate()", async () => {
        const cards = await transforms(150)
        expect(cards).toHaveLength(150)
        for (const transform of cards) {
            expect(transform).toContain("translate(")
            expect(transform).not.toContain("translate3d(")
        }
    })
})
