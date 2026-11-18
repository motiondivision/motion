import { act, useState } from "react"
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
        const { container } = render(<Card from={from} to={to} />)
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
})
