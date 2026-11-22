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

let toggle: VoidFunction
const toggles: Record<string, VoidFunction> = {}

function Cards({
    count,
    willChange,
    name = "",
    duration = 1,
}: {
    count: number
    willChange?: string
    name?: string
    duration?: number
}) {
    const [moved, setMoved] = useState(false)
    toggle = toggles[name] = () => setMoved((value) => !value)
    const transition = {
        layout: { type: "tween" as const, ease: "linear" as const, duration },
    }
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <motion.div
                    key={i}
                    className={"card " + name}
                    layout
                    layoutDependency={moved}
                    transition={transition}
                    data-moved={moved}
                    style={{ willChange }}
                >
                    <motion.div
                        className={"child " + name}
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

    test("every node in a layout animation within the budget gets will-change", async () => {
        const nodes = await animate(200)
        expect(nodes).toHaveLength(400)
        for (const { style } of nodes) {
            expect(style.willChange).toBe("transform")
        }
    })

    test("past the budget, no node gets will-change", async () => {
        const nodes = await animate(201)
        expect(nodes).toHaveLength(402)
        for (const { style } of nodes) {
            expect(style.willChange).toBe("")
            expect(style.transform).toContain("translate(")
            expect(style.transform).not.toContain("translate3d(")
        }
    })

    const willChanges = (name: string) =>
        Array.from(
            document.querySelectorAll<HTMLElement>("." + name),
            ({ style }) => style.willChange
        )

    test("nodes that start without will-change don't get it when others finish first", async () => {
        render(
            <>
                <Cards count={1} name="short" duration={0.1} />
                <Cards count={200} name="long" />
            </>
        )
        await frames(2)
        await act(async () => {
            toggles.short()
            toggles.long()
        })
        await frames(3)
        expect(new Set(willChanges("long"))).toEqual(new Set([""]))

        // The short animation is over: 400 nodes still move
        await frames(17)
        expect(document.querySelector<HTMLElement>(".short")!.style.transform).toBe(
            "none"
        )
        expect(new Set(willChanges("long"))).toEqual(new Set([""]))
    })

    test("nodes with will-change keep it when a few more take the count past the budget", async () => {
        render(
            <>
                <Cards count={199} name="first" />
                <Cards count={3} name="second" />
            </>
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))

        await act(async () => toggles.second())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
        expect(new Set(willChanges("second"))).toEqual(new Set(["transform"]))
    })

    test("nodes with will-change lose it when the count passes twice the budget", async () => {
        render(
            <>
                <Cards count={3} name="first" />
                <Cards count={400} name="second" />
            </>
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))

        await act(async () => toggles.second())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))
        expect(new Set(willChanges("second"))).toEqual(new Set([""]))
    })

    test("a small layout animation after one past the budget gets will-change", async () => {
        render(
            <>
                <Cards count={201} name="first" duration={0.1} />
                <Cards count={3} name="second" />
            </>
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(30)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))

        await act(async () => toggles.second())
        await frames(10)
        expect(new Set(willChanges("second"))).toEqual(new Set(["transform"]))
    })

    test("a layoutRoot on the page doesn't hold the decision between animations", async () => {
        render(
            <motion.div layoutRoot>
                <Cards count={201} name="first" duration={0.1} />
                <Cards count={3} name="second" />
            </motion.div>
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(30)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))

        await act(async () => toggles.second())
        await frames(10)
        expect(new Set(willChanges("second"))).toEqual(new Set(["transform"]))
    })

    test("a will-change set in style is left alone", async () => {
        await animate(3, "opacity")
        const cards = document.querySelectorAll<HTMLElement>(".card")
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
        await frames(70)
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
    })
})
