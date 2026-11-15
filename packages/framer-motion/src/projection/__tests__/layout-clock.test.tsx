import { visualElementStore } from "motion-dom"
import { act, useState } from "react"
import { stepFrames, withManualFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * Layout animations that start in the same frame share one clock. Each
 * still has its own transition, starts, completes and is interrupted by
 * itself.
 *
 * JSDOM has no layout, so getBoundingClientRect is mocked from a data
 * attribute.
 */
function box(left: number) {
    return {
        x: left,
        y: 0,
        top: 0,
        left,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: 100,
        toJSON() {},
    } as DOMRect
}

const frames = (ms: number) => stepFrames(ms)

const toggles: Record<string, VoidFunction> = {}

function Box({
    id,
    duration,
    onStart,
    onComplete,
}: {
    id: string
    duration: number
    onStart?: VoidFunction
    onComplete?: VoidFunction
}) {
    const [moved, setMoved] = useState(0)
    toggles[id] = () => setMoved((value) => value + 1)
    return (
        <motion.div
            id={id}
            layout
            layoutDependency={moved}
            transition={{ layout: { duration, ease: "linear" } }}
            data-moved={moved % 2 === 1}
            onLayoutAnimationStart={onStart}
            onLayoutAnimationComplete={onComplete}
        />
    )
}

const projectionOf = (id: string) =>
    visualElementStore.get(document.getElementById(id)!)!.projection!

const translateX = (id: string) =>
    parseFloat(
        document.getElementById(id)!.style.transform.split("(")[1] || "0"
    )

describe("layout animation clocks", () => {
    withManualFrames()

    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            return this.dataset.moved === "true" ? box(200) : box(0)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    test("layout animations that start in one frame complete by themselves", async () => {
        const started = { a: 0, b: 0 }
        const completed = { a: 0, b: 0 }
        render(
            <>
                <Box
                    id="a"
                    duration={0.2}
                    onStart={() => started.a++}
                    onComplete={() => completed.a++}
                />
                <Box
                    id="b"
                    duration={1}
                    onStart={() => started.b++}
                    onComplete={() => completed.b++}
                />
            </>
        )
        await frames(50)

        await act(async () => {
            toggles.a()
            toggles.b()
        })
        await frames(50)

        const a = projectionOf("a").currentAnimation as any
        const b = projectionOf("b").currentAnimation as any
        expect(a).not.toBe(b)
        expect(a.parent).toBe(b.parent)
        expect(started).toEqual({ a: 1, b: 1 })

        await frames(300)
        expect(completed).toEqual({ a: 1, b: 0 })
        expect(projectionOf("a").currentAnimation).toBeUndefined()
        expect(b.state).toBe("running")
        expect(translateX("b")).toBeLessThan(-100)

        await frames(800)
        expect(completed).toEqual({ a: 1, b: 1 })
        expect(started).toEqual({ a: 1, b: 1 })
    })

    test("interrupting one layout animation leaves the others on its clock", async () => {
        const completed = { a: 0, b: 0 }
        render(
            <>
                <Box id="a" duration={1} onComplete={() => completed.a++} />
                <Box id="b" duration={1} onComplete={() => completed.b++} />
            </>
        )
        await frames(50)

        await act(async () => {
            toggles.a()
            toggles.b()
        })
        await frames(500)
        const b = projectionOf("b").currentAnimation as any
        const halfway = translateX("b")
        expect(halfway).toBeLessThan(-50)
        expect(halfway).toBeGreaterThan(-150)

        /**
         * a turns back, on a clock of its own.
         */
        await act(async () => toggles.a())
        await frames(20)
        const a = projectionOf("a").currentAnimation as any
        expect(a.parent).not.toBe(b.parent)
        expect(b.state).toBe("running")
        expect(translateX("b")).toBeGreaterThan(halfway)

        await frames(550)
        expect(completed.b).toBe(1)
        expect(completed.a).toBe(0)
        expect(translateX("b")).toBe(0)
    })
})
