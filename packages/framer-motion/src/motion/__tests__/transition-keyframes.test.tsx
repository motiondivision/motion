import { motion, motionValue } from "../.."
import { render } from "../../jest.setup"
import { checkVariantsDidChange } from "../../render/utils/animation-state"

describe("keyframes transition", () => {
    test("keyframes as target", async () => {
        const promise = new Promise((resolve) => {
            const resolveContainer = () => {
                requestAnimationFrame(() => {
                    resolve(container)
                })
            }

            const Component = () => (
                <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: [10, 200] }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={resolveContainer}
                />
            )

            const { container, rerender } = render(<Component />)

            rerender(<Component />)
        })

        expect(promise).resolves.toHaveStyle("transform: translateX(200px)")
    })

    test("hasUpdated detects only changed keyframe arrays", async () => {
        expect(checkVariantsDidChange("1", "2")).toBe(true)
        expect(checkVariantsDidChange(["1", "2", "3"], ["1", "2", "3"])).toBe(
            false
        )
        expect(checkVariantsDidChange(["1", "2", "3"], ["1", "2", "4"])).toBe(
            true
        )
    })

    test("keyframes with non-pixel values", async () => {
        const promise = new Promise((resolve) => {
            const resolveContainer = () => {
                requestAnimationFrame(() => {
                    resolve(container)
                })
            }

            const Component = () => (
                <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: ["0%", "100%"] }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={resolveContainer}
                />
            )

            const { container, rerender } = render(<Component />)

            rerender(<Component />)
        })

        expect(promise).resolves.toHaveStyle("width: 100%;")
    })

    test("if initial={false}, take state of final keyframe", async () => {
        const xResult = await new Promise((resolve) => {
            const x = motionValue(0)
            const Component = ({ animate }: any) => {
                return (
                    <motion.div
                        initial={false}
                        animate={animate}
                        variants={{ a: { x: [0, 100] }, b: { x: [0, 100] } }}
                        transition={{ ease: () => 0.5, duration: 10 }}
                        style={{ x }}
                    />
                )
            }

            render(<Component animate="a" />)
            setTimeout(() => resolve(x.get()), 50)
        })

        expect(xResult).toBe(100)
    })

    test("keyframes animation doesn't rerun when variants change and keyframes are the same", async () => {
        const xResult = await new Promise((resolve) => {
            const x = motionValue(0)
            const Component = ({ animate }: any) => {
                return (
                    <motion.div
                        initial={false}
                        animate={animate}
                        variants={{
                            a: { x: [0, 100] },
                            b: { x: [0, 100], transition: { type: false } },
                        }}
                        transition={{ ease: () => 0.5, duration: 10 }}
                        style={{ x }}
                    />
                )
            }

            const { rerender } = render(<Component animate="a" />)
            rerender(<Component animate="b" />)
            rerender(<Component animate="a" />)
            setTimeout(() => resolve(x.get()), 50)
        })

        expect(xResult).toBe(100)
    })

    test("times works as expected", async () => {
        const values = await new Promise<number[]>((resolve) => {
            const output: number[] = []

            const Component = () => (
                <motion.div
                    animate={{ x: [50, 100, 200, 300] }}
                    transition={{ duration: 0.1, times: [0, 0, 1, 1] }}
                    onUpdate={(latest) =>
                        output.push(Math.round(latest.x as number))
                    }
                    onAnimationComplete={() => resolve(output)}
                    // Manually setting willChange to auto to prevent changes to willChange triggering onUpdate
                    style={{ willChange: "auto" }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(values[0] >= 100).toBe(true)
        expect(values[values.length - 2] <= 200).toBe(true)
    })
})
