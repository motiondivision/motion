import {
    buildProjectionTransform,
    motionValue,
    MotionValue,
    visualElementStore,
} from "motion-dom"
import { act, useState } from "react"
import { stepFrames, withManualFrames } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"

/**
 * A projection frame writes the projection, and the keys it can write
 * over, but no other key. And it doesn't write a style the projection
 * owns again while it's unchanged, unless something else has written to
 * the element since.
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

/**
 * Count the writes to some of an element's styles.
 */
function countWrites(element: HTMLElement, keys: string[]) {
    const counts: Record<string, number> = {}
    const proto = Object.getPrototypeOf(element.style)
    for (const key of keys) {
        counts[key] = 0
        let descriptor: PropertyDescriptor | undefined
        for (
            let p = proto;
            p && !(descriptor = Object.getOwnPropertyDescriptor(p, key));
            p = Object.getPrototypeOf(p)
        );
        Object.defineProperty(element.style, key, {
            configurable: true,
            get() {
                return descriptor!.get!.call(this)
            },
            set(v) {
                counts[key]++
                descriptor!.set!.call(this, v)
            },
        })
    }
    return counts
}

let toggle: VoidFunction
let setStyle: (style: object) => void

function Box({ values }: { values?: Record<string, MotionValue> }) {
    const [moved, setMoved] = useState(false)
    const [style, setStyleState] = useState<object>({})
    toggle = () => setMoved((value) => !value)
    setStyle = setStyleState
    return (
        <motion.div
            id="box"
            layout
            layoutDependency={moved}
            transition={transition}
            data-moved={moved}
            style={{ padding: 6, ...values, ...style }}
        />
    )
}

describe("projection writes", () => {
    withManualFrames()

    beforeEach(() => {
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            return this.dataset.moved === "true" ? box(200, 200) : box(0, 100)
        })
    })

    afterEach(() => jest.restoreAllMocks())

    async function start(values?: Record<string, MotionValue>) {
        render(<Box values={values} />)
        await frames(2)
        const element = document.getElementById("box")!
        const counts = countWrites(element, [
            "padding",
            "transform",
            "transformOrigin",
            "visibility",
            "opacity",
        ])
        await act(async () => toggle())
        await frames(2)
        for (const key in counts) counts[key] = 0
        return { element, counts }
    }

    test("a projection frame doesn't write keys the projection can't write over", async () => {
        const { element, counts } = await start()
        await frames(10)

        expect(element.style.transform).toContain("translate")
        expect(counts.transform).toBeGreaterThanOrEqual(10)
        expect(counts.padding).toBe(0)
        expect(element.style.padding).toBe("6px")
    })

    test("a projection frame doesn't write unchanged projection styles again", async () => {
        const { counts } = await start()
        await frames(10)

        expect(counts.visibility).toBe(0)
        expect(counts.opacity).toBe(0)
        expect(counts.transformOrigin).toBe(0)
    })

    test("a projection frame writes bound keys the projection can write over", async () => {
        const { element } = await start({ x: motionValue(10) })
        const writes: string[] = []
        const { set, get } = Object.getOwnPropertyDescriptor(
            element.style,
            "transform"
        )!
        Object.defineProperty(element.style, "transform", {
            configurable: true,
            get,
            set(v) {
                writes.push(v)
                set!.call(this, v)
            },
        })
        await frames(10)

        /**
         * x is written in each frame, then the projection over it.
         */
        const fromX = writes.filter((v) => v === "translateX(10px)")
        expect(fromX.length).toBeGreaterThanOrEqual(10)
        expect(fromX.length).toBe(writes.length / 2)
        expect(element.style.transform).toContain("translate")
        expect(element.style.transform).not.toBe("translateX(10px)")
    })

    test("a projection style is written again after its value writes over it", async () => {
        const visibility = motionValue("visible")
        const { element } = await start({ visibility })
        await frames(2)
        expect(element.style.visibility).toBe("")

        /**
         * Its value writes hidden, which the projection writes over.
         */
        visibility.set("hidden")
        await frames(1)
        expect(element.style.visibility).toBe("")
    })

    test("a projection style is written again after a render writes over it", async () => {
        const { element } = await start()
        await frames(2)
        expect(element.style.visibility).toBe("")

        /**
         * The component renders visibility without a layout update, and
         * the projection writes over it in the next frame, as it always has.
         */
        await act(async () => setStyle({ visibility: "hidden" }))
        await frames(1)
        expect(element.style.transform).toContain("translate")
        expect(element.style.visibility).toBe("")
    })

    /**
     * Without a translate or scale of its own, a lead renders its
     * projection delta rather than working out the delta into its target
     * with transforms, which is the same.
     */
    test.each([
        ["no transforms", {}],
        ["a rotate", { rotate: motionValue(10) }],
        ["an x", { x: motionValue(10) }],
        ["a scale", { scale: motionValue(2) }],
    ])(
        "a lead with %s renders the delta into its target with transforms",
        async (_, values: Record<string, MotionValue>) => {
            const { element } = await start(values)
            await frames(5)

            const projection = visualElementStore.get(element)!.projection!
            projection.applyTransformsToTarget()
            const transform = buildProjectionTransform(
                projection.projectionDeltaWithTransform!,
                projection.treeScale,
                projection.latestValues
            )
            expect(transform).toContain("translate")
            expect(element.style.transform).toBe(transform)
        }
    )

    test("a lead without transforms renders its delta in a render without a projection update", async () => {
        const { element } = await start()
        await frames(5)
        const before = element.style.transform
        expect(before).toContain("translate")

        const visualElement = visualElementStore.get(element)!
        visualElement.render()
        expect(element.style.transform).toBe(before)

        const projection = visualElement.projection!
        projection.applyTransformsToTarget()
        expect(
            buildProjectionTransform(
                projection.projectionDeltaWithTransform!,
                projection.treeScale,
                projection.latestValues
            )
        ).toBe(before)
    })
})
