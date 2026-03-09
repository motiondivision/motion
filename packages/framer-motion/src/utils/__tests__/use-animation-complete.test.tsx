import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion/proxy"
import { useMotionValue } from "../../value/use-motion-value"
import { useAnimationComplete } from "../use-animation-complete"

function ChildComponent({ onComplete }: { onComplete: () => void }) {
    useAnimationComplete(onComplete)
    return <div>Child</div>
}

describe("useAnimationComplete", () => {
    test("fires callback when parent motion component animation completes", async () => {
        const promise = new Promise<void>((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                return (
                    <motion.div
                        animate={{ x: 100 }}
                        style={{ x }}
                        transition={{ duration: 0.01 }}
                    >
                        <ChildComponent onComplete={() => resolve()} />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        await expect(promise).resolves.toBeUndefined()
    })

    test("receives the animation definition", async () => {
        const promise = new Promise((resolve) => {
            const Component = () => {
                const x = useMotionValue(0)
                return (
                    <motion.div
                        animate={{ x: 100 }}
                        style={{ x }}
                        transition={{ duration: 0.01 }}
                    >
                        <ChildComponent
                            onComplete={() => resolve(true)}
                        />
                    </motion.div>
                )
            }

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        await expect(promise).resolves.toBe(true)
    })

    test("does not fire for non-motion parents", async () => {
        const onComplete = jest.fn()

        const Component = () => (
            <div>
                <ChildComponent onComplete={onComplete} />
            </div>
        )

        render(<Component />)

        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(onComplete).not.toHaveBeenCalled()
    })
})
