import { act, useLayoutEffect, useState } from "react"
import { stepFrames, withManualFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * A layout animation that starts and ends outside the viewport can't be
 * seen, so it finishes instantly. JSDOM's viewport is 1024 x 768, and
 * getBoundingClientRect is mocked from data attributes.
 */
function box(top: number) {
    return {
        x: 0,
        y: top,
        top,
        left: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: top + 100,
        toJSON() {},
    } as DOMRect
}

const frames = (count: number) => stepFrames((count * 1000) / 60)

const transition = {
    type: "tween" as const,
    ease: "linear" as const,
    duration: 10,
}

let toggle: VoidFunction

/**
 * Small trees always animate, so add enough nodes that stay still.
 */
const padding = Array.from({ length: 500 }, (_, i) => (
    <motion.div key={i} layout />
))

function Card({ from, to }: { from: number; to: number }) {
    const [moved, setMoved] = useState(false)
    toggle = () => setMoved(true)
    return (
        <motion.div
            className="card"
            layout
            transition={transition}
            data-top={moved ? to : from}
        />
    )
}

describe("off-screen layout animations", () => {
    withManualFrames()

    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            return box(Number(this.dataset.top ?? 0))
        })
    })

    afterEach(() => jest.restoreAllMocks())

    async function transformAfterMove(from: number, to: number) {
        const { container } = render(
            <>
                {padding}
                <Card from={from} to={to} />
            </>
        )
        await frames(2)
        await act(async () => toggle())
        await frames(10)
        return container.querySelector<HTMLElement>(".card")!.style.transform
    }

    test("animates a layout change within the viewport", async () => {
        expect(await transformAfterMove(0, 300)).toContain("translate")
    })

    test("finishes a layout change below the viewport instantly", async () => {
        expect(await transformAfterMove(2000, 3000)).toBe("none")
    })

    test("animates a layout change into the viewport", async () => {
        expect(await transformAfterMove(3000, 300)).toContain("translate")
    })

    test("animates a card in a transformed track that moves into view", async () => {
        /**
         * The track's x is in the browser's measurement only while it's
         * applied, which it isn't when the new layout is measured.
         */
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            const shift = /-3000px/.test(this.parentElement!.style.transform)
                ? -3000
                : 0
            const left = Number(this.dataset.left ?? 0) + shift
            return { ...box(0), x: left, left, right: left + 100 } as DOMRect
        })

        let move: VoidFunction = () => {}
        function Track() {
            const [moved, setMoved] = useState(false)
            move = () => setMoved(true)
            return (
                <motion.div style={{ x: -3000 }}>
                    <motion.div
                        className="card"
                        layout
                        transition={transition}
                        data-left={moved ? 3000 : 4500}
                    />
                </motion.div>
            )
        }

        const { container } = render(
            <>
                {padding}
                <Track />
            </>
        )
        await frames(2)
        await act(async () => move())
        await frames(10)
        expect(
            container.querySelector<HTMLElement>(".card")!.style.transform
        ).toContain("translate")
    })

    test("animates an item that a layoutScroll container scrolls into view", async () => {
        let scrollTop = 0
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            if (this.dataset.scroller !== undefined) {
                return { ...box(0), height: 500, bottom: 500 } as DOMRect
            }
            return box(Number(this.dataset.top ?? 0) - scrollTop)
        })

        let move: VoidFunction = () => {}
        function List() {
            const [moved, setMoved] = useState(false)
            move = () => setMoved(true)
            // The list scrolls to follow the item, after the snapshot.
            useLayoutEffect(() => {
                if (moved) scrollTop = 1000
            }, [moved])
            return (
                <motion.div
                    layoutScroll
                    data-scroller
                    ref={(element: HTMLElement | null) => {
                        element &&
                            Object.defineProperty(element, "scrollTop", {
                                get: () => scrollTop,
                                configurable: true,
                            })
                    }}
                >
                    <motion.div
                        className="card"
                        layout
                        transition={transition}
                        data-top={moved ? 2000 : 1100}
                    />
                </motion.div>
            )
        }

        const { container } = render(
            <>
                {padding}
                <List />
            </>
        )
        await frames(2)
        await act(async () => move())
        await frames(10)
        expect(
            container.querySelector<HTMLElement>(".card")!.style.transform
        ).toContain("translate")
    })
})

