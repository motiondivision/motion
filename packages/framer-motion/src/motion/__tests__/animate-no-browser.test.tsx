/**
 * Regression tests for issue #3565:
 * Animations stop working in Next.js when isBrowser is incorrectly
 * compiled to false by the build system (e.g. Next.js .next cache issue).
 *
 * In Next.js App Router, typeof window may be evaluated at build time
 * in a Node.js context and compiled as false into the client bundle.
 * This caused isBrowser = false, which skipped useVisualElement entirely,
 * leaving all motion components without an animation state.
 */
jest.mock("../../utils/is-browser", () => ({
    isBrowser: false,
}))

import { frame } from "motion-dom"
import { motion } from "../../"
import { motionValue } from "../../"
import { render } from "../../jest.setup"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("animations with isBrowser=false (Next.js build cache regression)", () => {
    test("animates initial to animate when isBrowser is false", async () => {
        const opacity = motionValue(0)
        const Component = () => (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: false }}
                style={{ opacity }}
            />
        )
        render(<Component />)
        await nextFrame()
        expect(opacity.get()).toBe(1)
    })

    test("animates y transform when isBrowser is false", async () => {
        const y = motionValue(20)
        const Component = () => (
            <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ type: false }}
                style={{ y }}
            />
        )
        render(<Component />)
        await nextFrame()
        expect(y.get()).toBe(0)
    })
})
