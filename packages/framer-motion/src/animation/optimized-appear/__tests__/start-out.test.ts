import { frame } from "motion-dom"
import { startOptimizedAppearAnimation } from "../start"

/**
 * The appear script side of transition.out (#1725). A generator that builds
 * an appear animation from initial's out transition passes `out: true` with
 * its options. The script records it and exposes it to the runtime through
 * window.MotionHandoffUsesOut, without changing anything older runtimes use.
 */
describe("startOptimizedAppearAnimation with out", () => {
    const animate = jest.fn()

    beforeAll(() => {
        animate.mockImplementation(() => ({
            ready: Promise.resolve(),
            cancel: jest.fn(),
            play: jest.fn(),
            startTime: null,
        }))
        ;(Element.prototype as any).animate = animate
    })

    afterAll(() => {
        delete (Element.prototype as any).animate
    })

    const createElement = (id: string) => {
        const element = document.createElement("div")
        element.dataset.framerAppearId = id
        return element
    }

    const start = (
        id: string,
        name: string,
        keyframes: string[] | number[],
        options: any
    ) =>
        new Promise<Animation>((resolve) =>
            startOptimizedAppearAnimation(
                createElement(id),
                name,
                keyframes,
                options,
                resolve
            )
        )

    test("records which appear animations were generated from out", async () => {
        await start("a", "opacity", [0, 1], { duration: 1000, out: true })
        await start("b", "opacity", [0, 1], { duration: 1000 })
        await start("c", "transform", ["none", "translateX(10px)"], {
            duration: 1000,
            out: true,
        })

        expect(window.MotionHandoffUsesOut!("a", "opacity")).toBe(true)
        expect(window.MotionHandoffUsesOut!("b", "opacity")).toBe(false)
        expect(window.MotionHandoffUsesOut!("c", "x")).toBe(true)
        expect(window.MotionHandoffUsesOut!("d", "opacity")).toBe(false)
    })

    test("out isn't passed to the browser animation", () => {
        for (const [, options] of animate.mock.calls) {
            expect(options).not.toHaveProperty("out")
        }
    })

    test("older runtimes hand off as before: three arguments, a start time back", () => {
        expect(
            typeof window.MotionHandoffAnimation!("a", "opacity", frame)
        ).toBe("number")
    })
})
