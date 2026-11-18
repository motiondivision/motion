/**
 * A node's snapshot has its ancestors' transforms removed. An ancestor is
 * only measured for that when its x or y is a percentage of its own size.
 */

import { createRef, RefObject } from "react"
import { visualElementStore } from "motion-dom"
import { motion } from "../../render/components/motion"
import { render } from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

const rect = (left: number, width: number) =>
    ({
        left,
        width,
        right: left + width,
        x: left,
        top: 0,
        y: 0,
        height: 50,
        bottom: 50,
        toJSON: () => ({}),
    } as DOMRect)

async function snapshotItems(x: number | string) {
    const wrapper = createRef<HTMLDivElement>()
    const items: RefObject<HTMLDivElement>[] = [
        createRef(),
        createRef(),
        createRef(),
    ]

    const Component = ({ gap }: { gap: number }) => (
        <motion.div ref={wrapper} style={{ x }}>
            {items.map((ref, i) => (
                <motion.div key={i} ref={ref} layout style={{ margin: gap }} />
            ))}
        </motion.div>
    )

    const { rerender } = render(<Component gap={0} />)

    /**
     * Once a tree has animated, a node that mounts is measured in an update
     * of its own.
     */
    await nextFrame()

    /**
     * The wrapper is 400px wide and laid out at 100px. The items are 50px
     * wide and laid out from its left edge. Both are measured where the
     * wrapper's transform has moved them.
     */
    const offset = typeof x === "number" ? x : 200
    const measureWrapper = jest.fn(() => rect(100 + offset, 400))
    wrapper.current!.getBoundingClientRect = measureWrapper

    const snapshots: number[] = []
    items.forEach((ref, i) => {
        ref.current!.getBoundingClientRect = () =>
            rect(100 + offset + i * 50, 50)

        visualElementStore
            .get(ref.current!)!
            .projection!.addEventListener("didUpdate", ({ snapshot }: any) =>
                snapshots.push(snapshot.layoutBox.x.min)
            )
    })

    rerender(<Component gap={10} />)
    await nextFrame()

    return { snapshots, measureWrapper }
}

describe("removing an ancestor's transform from a snapshot", () => {
    test("doesn't measure an ancestor moved by a number of pixels", async () => {
        const { snapshots, measureWrapper } = await snapshotItems(30)

        expect(snapshots).toEqual([100, 150, 200])
        expect(measureWrapper).not.toHaveBeenCalled()
    })

    test("measures an ancestor moved by a percentage of its size", async () => {
        const { snapshots, measureWrapper } = await snapshotItems("50%")

        expect(snapshots).toEqual([100, 150, 200])
        expect(measureWrapper).toHaveBeenCalled()
    })
})
