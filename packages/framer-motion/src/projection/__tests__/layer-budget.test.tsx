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
function box(left: number, width: number, top = 0) {
    return {
        x: left,
        y: top,
        top,
        left,
        width,
        height: 100,
        right: left + width,
        bottom: top + 100,
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
    top = 0,
    still,
    style,
    opacity,
    layoutScroll,
}: {
    top?: number | string
    /** The card only moves, and the child keeps its place in it. */
    still?: boolean
    style?: Record<string, string | number>
    /** Animate opacity too, for this long. */
    opacity?: number
    layoutScroll?: boolean
    count: number
    willChange?: string
    name?: string
    duration?: number
}) {
    const [moved, setMoved] = useState(false)
    toggle = toggles[name] = () => setMoved((value) => !value)
    const transition = {
        layout: { type: "tween" as const, ease: "linear" as const, duration },
        opacity: { type: "tween" as const, duration: opacity },
    }
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <motion.div
                    key={i}
                    className={"card " + name}
                    layout
                    layoutDependency={`${moved}${still}`}
                    transition={transition}
                    data-moved={moved}
                    data-top={top}
                    data-plain={still}
                    layoutScroll={layoutScroll}
                    animate={opacity ? { opacity: moved ? 0.5 : 1 } : undefined}
                    style={{ willChange, ...style }}
                >
                    <motion.div
                        className={"child " + name}
                        layout
                        layoutDependency={`${moved}${still}`}
                        transition={transition}
                        data-moved={moved}
                        data-top={top}
                        data-still={still}
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
            /**
             * A card with a y of -5000 is laid out 5000px down the page,
             * which is where it measures once its transform is reset.
             */
            const top =
                this.dataset.top === "pulled"
                    ? !this.style.transform || this.style.transform === "none"
                        ? 5000
                        : 0
                    : Number(this.dataset.top)
            if (this.dataset.still) {
                return this.dataset.moved === "true"
                    ? box(210, 20, top)
                    : box(10, 20, top)
            }
            if (this.dataset.scale !== undefined) {
                return this.dataset.moved === "true"
                    ? box(260, 50, top)
                    : box(10, 20, top)
            }
            return this.dataset.moved === "true"
                ? box(200, this.dataset.plain ? 100 : 200, top)
                : box(0, 100, top)
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

    test("nodes with will-change keep it when more start, and those past the budget get none", async () => {
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
        expect(new Set(willChanges("second"))).toEqual(new Set([""]))
    })

    test("a small layout animation that starts while one past the budget still runs gets will-change", async () => {
        render(
            <>
                <Cards count={201} name="first" duration={2} />
                <Cards count={3} name="second" />
            </>
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))

        await act(async () => toggles.second())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))
        expect(new Set(willChanges("second"))).toEqual(new Set(["transform"]))
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

    test("nodes that stay far outside the viewport get no will-change and don't use the budget", async () => {
        render(
            <>
                <Cards count={3} name="visible" />
                <Cards count={199} name="hidden" top={5000} />
            </>
        )
        await frames(2)
        await act(async () => {
            toggles.visible()
            toggles.hidden()
        })
        await frames(10)
        expect(new Set(willChanges("visible"))).toEqual(new Set(["transform"]))
        expect(new Set(willChanges("hidden"))).toEqual(new Set([""]))
    })

    test("a few nodes far outside the viewport get no will-change", async () => {
        render(<Cards count={3} name="hidden" top={5000} />)
        await frames(2)
        await act(async () => toggles.hidden())
        await frames(10)
        expect(new Set(willChanges("hidden"))).toEqual(new Set([""]))
    })

    test("a node with a transform of its own counts as in view", async () => {
        render(
            <Cards count={3} name="first" top="pulled" style={{ y: -5000 }} />
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
    })

    test("a fixed node counts as in view on a scrolled page", async () => {
        Object.defineProperty(document.documentElement, "scrollTop", {
            value: 5000,
            configurable: true,
        })
        render(
            <Cards
                count={3}
                name="first"
                layoutScroll
                style={{ position: "fixed" }}
            />
        )
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        delete (document.documentElement as any).scrollTop
        const cards = document.querySelectorAll<HTMLElement>(".card")
        for (const { style } of cards) expect(style.willChange).toBe("transform")
    })

    test("nodes that keep their place in a parent don't use the budget", async () => {
        render(<Cards count={201} name="first" still />)
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        const cards = document.querySelectorAll<HTMLElement>(".card")
        for (const { style } of cards) expect(style.willChange).toBe("transform")
        for (const { style } of document.querySelectorAll<HTMLElement>(".child")) {
            expect(style.willChange).toBe("")
        }
    })

    test("a node that changes size with a corrected border radius gets no will-change", async () => {
        render(<Cards count={1} style={{ borderRadius: 10 }} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        const [card, child] = elements()
        expect(card.style.willChange).toBe("")
        expect(child.style.willChange).toBe("transform")
    })

    test("a node that changes size with a corrected box shadow gets no will-change", async () => {
        render(
            <Cards count={1} style={{ boxShadow: "0px 2px 4px #000" }} />
        )
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        expect(elements()[0].style.willChange).toBe("")
    })

    test("a node that only moves with a corrected border radius gets will-change", async () => {
        render(<Cards count={1} still style={{ borderRadius: 10 }} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        expect(elements()[0].style.willChange).toBe("transform")
    })

    test("nodes with a corrected border radius don't use the budget", async () => {
        render(<Cards count={250} style={{ borderRadius: 10 }} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        const all = elements()
        expect(all.filter((el) => el.style.willChange).length).toBe(250)
        expect(
            all.every(
                (el) =>
                    el.style.willChange ===
                    (el.className.includes("child") ? "transform" : "")
            )
        ).toBe(true)
    })

    test("will-change is removed when another value of the node animates for longer", async () => {
        render(<Cards count={3} name="first" opacity={2} />)
        await frames(2)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
        await frames(200)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))
    })

    test("nodes get will-change on the first frame they move", async () => {
        render(<Cards count={3} name="first" />)
        await frames(2)
        await act(async () => toggles.first())
        await frames(1)
        const first = document.querySelector<HTMLElement>(".first")!
        expect(first.style.transform).toContain("translate(")
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
    })

    test("will-change is removed after an animation is reversed part way", async () => {
        render(<Cards count={3} name="first" />)
        await frames(2)
        await act(async () => toggles.first())
        await frames(20)
        await act(async () => toggles.first())
        await frames(10)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
        await frames(70)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))
    })

    test("will-change is removed when a node stops being a layout node part way", async () => {
        function Card() {
            const [state, setState] = useState(0)
            toggle = () => setState((value) => value + 1)
            return (
                <motion.div
                    className="card first"
                    layout={state < 2}
                    layoutDependency={state}
                    data-moved={state > 0}
                    data-top={0}
                    transition={{
                        layout: { type: "tween", ease: "linear", duration: 1 },
                    }}
                />
            )
        }
        render(<Card />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        expect(willChanges("first")).toEqual(["transform"])
        await act(async () => toggle())
        await frames(70)
        expect(willChanges("first")).toEqual([""])
    })

    test("will-change is removed from a node that another with its layoutId hides", async () => {
        function Shared() {
            const [state, setState] = useState(0)
            toggle = () => setState((value) => value + 1)
            const transition = {
                layout: { type: "tween" as const, ease: "linear" as const, duration: 1 },
            }
            return (
                <>
                    <motion.div
                        className="card first"
                        layoutId="shared"
                        layoutCrossfade={false}
                        layoutDependency={state}
                        data-moved={state > 0}
                        data-top={0}
                        transition={transition}
                    />
                    {state > 1 && (
                        <motion.div
                            className="card second"
                            layoutId="shared"
                            layoutCrossfade={false}
                            data-moved="false"
                            data-top={300}
                            transition={transition}
                        />
                    )}
                </>
            )
        }
        render(<Shared />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        expect(willChanges("first")).toEqual(["transform"])
        await act(async () => toggle())
        await frames(10)
        const first = document.querySelector<HTMLElement>(".first")!
        expect(first.style.visibility).toBe("hidden")
        expect(first.style.willChange).toBe("")
    })

    test("a node loses will-change when it starts to change size with a corrected border radius", async () => {
        const style = { borderRadius: 10 }
        const { rerender } = render(<Cards count={1} still style={style} />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        const [card] = elements()
        expect(card.style.willChange).toBe("transform")
        await act(async () => rerender(<Cards count={1} style={style} />))
        await frames(10)
        expect(card.style.transform).toContain("scale")
        expect(card.style.willChange).toBe("")
    })

    test("a node that follows another with its layoutId gets no will-change", async () => {
        function Shared() {
            const [state, setState] = useState(false)
            toggle = () => setState(true)
            const transition = {
                layout: { type: "tween" as const, ease: "linear" as const, duration: 1 },
            }
            return (
                <>
                    <motion.div
                        className="card first"
                        layoutId="radius"
                        data-moved="false"
                        data-top={0}
                        transition={transition}
                    />
                    {state && (
                        <motion.div
                            className="card second"
                            layoutId="radius"
                            data-moved="true"
                            data-top={0}
                            transition={transition}
                            style={{ borderRadius: 10 }}
                        />
                    )}
                </>
            )
        }
        render(<Shared />)
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        const first = document.querySelector<HTMLElement>(".first")!
        expect(first.style.transform).toContain("scale")
        expect(first.style.borderTopLeftRadius).not.toBe("")
        expect(willChanges("first")).toEqual([""])
        expect(willChanges("second")).toEqual([""])
    })

    test("a will-change set in style is left alone", async () => {
        await animate(3, "opacity")
        const cards = document.querySelectorAll<HTMLElement>(".card")
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
        await frames(70)
        for (const { style } of cards) expect(style.willChange).toBe("opacity")
    })

    test("finished nodes give their place in the budget back", async () => {
        render(
            <>
                <Cards count={199} name="first" duration={0.1} />
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

    test("nodes that went without will-change decide again the next time they move", async () => {
        render(
            <>
                <Cards count={3} name="first" duration={0.1} />
                <Cards count={200} name="second" duration={0.1} />
            </>
        )
        await frames(2)
        await act(async () => {
            toggles.first()
            toggles.second()
        })
        await frames(3)
        expect(new Set(willChanges("first"))).toEqual(new Set([""]))
        await frames(30)

        await act(async () => toggles.first())
        await frames(3)
        expect(new Set(willChanges("first"))).toEqual(new Set(["transform"]))
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

})
