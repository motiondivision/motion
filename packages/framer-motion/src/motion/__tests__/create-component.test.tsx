import { motionValue } from "motion-dom"
import { render } from "../../jest.setup"
import { motion as motionProxy } from "../../render/components/motion/proxy"

const motion = { div: motionProxy.create("div") }

describe("Create DOM Motion component", () => {
    test("Animates", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())
            const Component = () => (
                <motion.div
                    animate={{ x: 20 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })
})
