import { motion } from "../.."
import { render } from "../../jest.setup"

const MATRIX = "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"

/**
 * #2654: animating transform from its default to a matrix3d() value
 * produces invalid keyframes like "matrix0d(...)".
 */
test("animating to matrix3d only outputs valid matrix3d values", async () => {
    const output: string[] = []

    await new Promise<void>((resolve) => {
        render(
            <motion.div
                animate={{ transform: MATRIX }}
                transition={{ duration: 0.05 }}
                onUpdate={({ transform }) => output.push(transform as string)}
                onAnimationComplete={() => resolve()}
            />
        )
    })

    expect(output.length).toBeGreaterThan(0)
    for (const value of output) {
        expect(value).toMatch(/^(none|matrix3d\()/)
    }
})
