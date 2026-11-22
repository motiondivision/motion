import { act, useState } from "react"
import { stepFrames } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { LazyMotion } from "../../../components/LazyMotion"
import { m } from "../../components/m"
import { domBasicLayout } from "../features-basic-layout"
import { rootProjectionNode } from "motion-dom"

/**
 * domBasicLayout animates layout changes without shared layoutId
 * animations, drag, or the default scale correctors.
 */
function box(top: number, left: number, width: number, height: number) {
    return {
        x: left,
        y: top,
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {},
    } as DOMRect
}

let toggle: VoidFunction

function App() {
    const [isMoved, setMoved] = useState(false)
    toggle = () => setMoved((value) => !value)
    return (
        <LazyMotion features={domBasicLayout}>
            <m.div
                id="box"
                layout
                data-moved={isMoved}
                transition={{ type: "tween", ease: "linear", duration: 10 }}
            />
        </LazyMotion>
    )
}

describe("domBasicLayout", () => {
    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            return this.dataset.moved === "true"
                ? box(100, 0, 100, 100)
                : box(0, 0, 100, 100)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    test("animates a layout change", async () => {
        render(<App />)
        await stepFrames(50)

        await act(async () => toggle())
        await stepFrames(16)

        const element = document.getElementById("box")!
        const translateY = parseFloat(
            element.style.transform.match(
                /translate(?:3d)?\([^,]+, ([-\d.]+)px/
            )?.[1] ?? "0"
        )
        // It starts where it was, 100px above, and moves towards 0
        expect(translateY).toBeLessThan(0)
        expect(translateY).toBeGreaterThan(-100)
    })

    test("doesn't set up shared layout", async () => {
        render(<App />)
        await stepFrames(50)
        expect(rootProjectionNode.current?.sharedNodes).toBeUndefined()
    })
})
