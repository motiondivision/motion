import { motionValue } from "motion-dom"
import { act } from "react"
import { motion } from "../../render/components/motion"
import { render } from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

/**
 * A parent's variant change gives each child a delay from its place among
 * its siblings. Their document order is worked out once for the dispatch,
 * and not at all when no delay depends on it.
 */
describe("variant children order", () => {
    const count = (fn: () => void) => {
        const compare = jest.spyOn(Node.prototype, "compareDocumentPosition")
        fn()
        const calls = compare.mock.calls.length
        compare.mockRestore()
        return calls
    }

    const List = ({
        label,
        transition,
        values,
    }: {
        label: string
        transition: any
        values: ReturnType<typeof motionValue>[]
    }) => (
        <motion.div
            animate={label}
            variants={{ a: { transition }, b: { transition } }}
        >
            {values.map((opacity, i) => (
                <motion.div
                    key={i}
                    style={{ opacity }}
                    variants={{ a: { opacity: 1 }, b: { opacity: 0.5 } }}
                    transition={{ type: false }}
                />
            ))}
        </motion.div>
    )

    const values = Array.from({ length: 100 }, () => motionValue(1))

    test("isn't sorted when no delay depends on it", async () => {
        const { rerender } = render(
            <List
                label="a"
                transition={{ delayChildren: 0.1 }}
                values={values}
            />
        )
        await nextFrame()

        expect(
            count(() =>
                rerender(
                    <List
                        label="b"
                        transition={{ delayChildren: 0.1 }}
                        values={values}
                    />
                )
            )
        ).toBe(0)
    })

    test("is sorted once for a stagger", async () => {
        const { rerender } = render(
            <List
                label="a"
                transition={{ staggerChildren: 0.01 }}
                values={values}
            />
        )
        await nextFrame()

        const calls = count(() =>
            rerender(
                <List
                    label="b"
                    transition={{ staggerChildren: 0.01 }}
                    values={values}
                />
            )
        )

        // One sort of 100 children, not one per child
        expect(calls).toBeGreaterThan(0)
        expect(calls).toBeLessThan(1000)
    })

    test("staggers children in document order, reversed and by function", async () => {
        const starts: number[][] = [[], [], []]
        const transitions = [
            { staggerChildren: 0.1 },
            { staggerChildren: 0.1, staggerDirection: -1 },
            { delayChildren: (i: number, n: number) => (n - i) / 10 },
        ]

        for (let t = 0; t < transitions.length; t++) {
            const vals = Array.from({ length: 3 }, () => motionValue(1))
            const { rerender, unmount } = render(
                <List label="a" transition={transitions[t]} values={vals} />
            )
            await nextFrame()
            const started = performance.now()
            vals.forEach((v, i) =>
                v.on("change", () => {
                    starts[t][i] ??= performance.now() - started
                })
            )
            await act(async () => {
                rerender(
                    <List label="b" transition={transitions[t]} values={vals} />
                )
            })
            await new Promise((resolve) => setTimeout(resolve, 450))
            unmount()
        }

        const isIncreasing = (a: number[]) => a[0] < a[1] && a[1] < a[2]
        const isDecreasing = (a: number[]) => a[0] > a[1] && a[1] > a[2]
        expect(isIncreasing(starts[0])).toBe(true)
        expect(isDecreasing(starts[1])).toBe(true)
        expect(isDecreasing(starts[2])).toBe(true)
    })
})
