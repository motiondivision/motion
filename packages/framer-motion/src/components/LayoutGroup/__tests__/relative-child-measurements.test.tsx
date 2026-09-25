import { frame, Transition } from "motion-dom"
import { act, memo, useState } from "react"
import { render } from "../../../jest.setup"
import { motion } from "../../../render/components/motion"
import { LayoutGroup } from "../index"

/**
 * #parent shares a LayoutGroup with #expander, so toggling #expander
 * re-measures #parent. Each child is in its own LayoutGroup inherit="id",
 * so it isn't re-measured with #parent and must follow it via its relative
 * target.
 *
 * JSDOM has no layout, so getBoundingClientRect is mocked. Boxes are derived
 * from DOM attributes so snapshots taken before React commits see the old
 * layout.
 */
const reads: Record<string, number> = {}

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

function rect(element: HTMLElement): DOMRect {
    const expanded =
        document.getElementById("expander")?.dataset.expanded === "true"
    const parentTop = expanded ? 110 : 35

    if (element.id === "expander") return box(0, 0, 100, expanded ? 100 : 25)
    if (element.id === "parent") return box(parentTop, 0, 400, 40)
    if (element.id.startsWith("child")) {
        const index = Number(element.id.slice(5))
        const shift = element.dataset.shift === "true" ? 100 : 0
        return box(parentTop + 5, 50 + shift + index * 20, 50, 30)
    }
    return box(0, 0, 0, 0)
}

const long: Transition = {
    layout: { type: "tween", ease: "linear", duration: 10 },
}
const short: Transition = {
    layout: { type: "tween", ease: "linear", duration: 0.05 },
}

let toggleExpander: VoidFunction
const toggleChild: Record<string, VoidFunction> = {}

function Expander() {
    const [expanded, setExpanded] = useState(false)
    toggleExpander = () => setExpanded((value) => !value)
    return (
        <motion.div
            id="expander"
            layout
            transition={long}
            data-expanded={expanded}
        />
    )
}

const Child = memo(
    ({ id, transition }: { id: string; transition: Transition }) => {
        const [shift, setShift] = useState(false)
        toggleChild[id] = () => setShift((value) => !value)
        return (
            <motion.div
                id={id}
                layout
                transition={transition}
                data-shift={shift}
            />
        )
    }
)

function App({
    childCount = 1,
    childTransition = long,
}: {
    childCount?: number
    childTransition?: Transition
}) {
    const children = []
    for (let i = 0; i < childCount; i++) {
        children.push(
            <LayoutGroup key={i} inherit="id">
                <Child id={"child" + i} transition={childTransition} />
            </LayoutGroup>
        )
    }

    return (
        <LayoutGroup>
            <Expander />
            <motion.div id="parent" layout transition={long}>
                {children}
            </motion.div>
        </LayoutGroup>
    )
}

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

async function frames(count: number) {
    for (let i = 0; i < count; i++) await nextFrame()
}

async function update(callback: VoidFunction) {
    await act(async () => callback())
    await frames(2)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Children are DOM descendants of #parent, so their visual offset from
 * #parent is their own layout offset plus their own projection translate.
 */
function childOffset(id = "child0") {
    const element = document.getElementById(id)!
    const translateY = parseFloat(element.style.transform.split(",")[1]) || 0
    return (
        rect(element).top -
        rect(document.getElementById("parent")!).top +
        translateY
    )
}

function resetReads() {
    for (const id in reads) delete reads[id]
}

function childReads() {
    let total = 0
    for (const id in reads) if (id.startsWith("child")) total += reads[id]
    return total
}

describe("relative children when their relative parent re-lays out", () => {
    beforeEach(() => {
        resetReads()
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            reads[this.id] = (reads[this.id] || 0) + 1
            return rect(this)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    test("doesn't measure a child that isn't animating", async () => {
        render(<App />)
        await frames(2)

        await update(toggleExpander)
        await frames(3)
        const offset = childOffset()
        resetReads()
        await update(toggleExpander)

        expect(reads.parent).toBeGreaterThan(0)
        expect(childReads()).toBe(0)
        expect(childOffset()).toBeCloseTo(offset, 0)
    })

    test("doesn't measure a layout-animating child without a relative target", async () => {
        render(<App />)
        await frames(2)
        await update(toggleChild.child0)
        await frames(3)
        expect(document.getElementById("child0")!.style.transform).toContain(
            "translate"
        )

        resetReads()
        await update(toggleExpander)

        expect(reads.parent).toBeGreaterThan(0)
        expect(childReads()).toBe(0)
    })

    test("measures a layout-animating child once, so it doesn't jump", async () => {
        render(<App />)
        await frames(2)
        await update(toggleExpander)
        await update(toggleChild.child0)
        await frames(3)

        const offset = childOffset()
        resetReads()
        await update(toggleExpander)

        expect(reads.child0).toBe(1)
        expect(Math.abs(childOffset() - offset)).toBeLessThan(1)
    })

    test("doesn't measure a child whose animation finished while its parent is still animating", async () => {
        render(<App childTransition={short} />)
        await frames(2)
        await update(toggleExpander)
        await update(toggleChild.child0)
        await wait(300)
        await frames(2)

        const offset = childOffset()
        resetReads()
        await update(toggleExpander)

        expect(childReads()).toBe(0)
        expect(Math.abs(childOffset() - offset)).toBeLessThan(1)
    })

    test("doesn't measure a child whose animation finished once the tree settled", async () => {
        render(<App childTransition={short} />)
        await frames(2)
        await update(toggleChild.child0)
        await wait(300)
        await frames(2)

        resetReads()
        await update(toggleExpander)

        expect(childReads()).toBe(0)
    })

    test("measures each layout-animating child once per parent re-layout", async () => {
        render(<App childCount={10} />)
        await frames(2)
        await update(toggleExpander)
        for (let i = 0; i < 10; i++) await update(toggleChild["child" + i])
        await frames(3)

        resetReads()
        for (let i = 0; i < 5; i++) {
            const offsets: number[] = []
            for (let c = 0; c < 10; c++) offsets.push(childOffset("child" + c))

            await update(toggleExpander)

            for (let c = 0; c < 10; c++) {
                expect(
                    Math.abs(childOffset("child" + c) - offsets[c])
                ).toBeLessThan(1)
            }
        }

        expect(reads.parent).toBe(10)
        expect(childReads()).toBe(50)
    })
})
