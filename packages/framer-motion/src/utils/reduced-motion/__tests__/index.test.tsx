import { hasReducedMotionListener } from "motion-dom"
import { render } from "../../../jest.setup"
import { motion } from "../../../render/components/motion"
import { MotionConfig } from "../../../components/MotionConfig"

describe("reduced motion listener initialization", () => {
    beforeEach(() => {
        // Reset the listener state before each test
        hasReducedMotionListener.current = false
    })

    test("should not initialize listener when reducedMotionConfig is 'never'", () => {
        const Component = () => (
            <MotionConfig reducedMotion="never">
                <motion.div animate={{ opacity: 1 }} />
            </MotionConfig>
        )

        render(<Component />)

        // When reducedMotionConfig is "never", the listener should not be initialized
        expect(hasReducedMotionListener.current).toBe(false)
    })

    test("should not initialize listener when reducedMotionConfig is 'always'", () => {
        const Component = () => (
            <MotionConfig reducedMotion="always">
                <motion.div animate={{ opacity: 1 }} />
            </MotionConfig>
        )

        render(<Component />)

        // When reducedMotionConfig is "always", the listener should not be initialized
        expect(hasReducedMotionListener.current).toBe(false)
    })

    test("should initialize listener when reducedMotionConfig is 'user'", () => {
        const Component = () => (
            <MotionConfig reducedMotion="user">
                <motion.div animate={{ opacity: 1 }} />
            </MotionConfig>
        )

        render(<Component />)

        // When reducedMotionConfig is "user", the listener should be initialized
        // to detect the user's prefers-reduced-motion setting
        expect(hasReducedMotionListener.current).toBe(true)
    })

    test("should not initialize listener with default config (defaults to 'never')", () => {
        // The default MotionConfigContext has reducedMotion: "never"
        const Component = () => <motion.div animate={{ opacity: 1 }} />

        render(<Component />)

        // Default context has reducedMotion: "never", so no listener
        expect(hasReducedMotionListener.current).toBe(false)
    })

    test("should initialize listener only once across multiple components with 'user' config", () => {
        hasReducedMotionListener.current = false

        const Component = () => (
            <MotionConfig reducedMotion="user">
                <motion.div animate={{ opacity: 1 }} />
                <motion.div animate={{ x: 100 }} />
                <motion.div animate={{ scale: 1.5 }} />
            </MotionConfig>
        )

        render(<Component />)

        // The listener should have been initialized once
        expect(hasReducedMotionListener.current).toBe(true)
    })

    test("mixed configurations - 'never' and 'always' do not trigger listener", () => {
        hasReducedMotionListener.current = false

        const Component = () => (
            <>
                <MotionConfig reducedMotion="never">
                    <motion.div data-testid="never" animate={{ opacity: 1 }} />
                </MotionConfig>
                <MotionConfig reducedMotion="always">
                    <motion.div data-testid="always" animate={{ opacity: 1 }} />
                </MotionConfig>
            </>
        )

        render(<Component />)

        // Neither "never" nor "always" should trigger listener initialization
        expect(hasReducedMotionListener.current).toBe(false)
    })

    test("'user' config triggers listener, explicit 'never'/'always' do not", () => {
        hasReducedMotionListener.current = false

        const ComponentWithNever = () => (
            <MotionConfig reducedMotion="never">
                <motion.div animate={{ opacity: 1 }} />
            </MotionConfig>
        )

        const ComponentWithUser = () => (
            <MotionConfig reducedMotion="user">
                <motion.div animate={{ opacity: 1 }} />
            </MotionConfig>
        )

        // First render with "never" - should not initialize listener
        const { unmount: unmount1 } = render(<ComponentWithNever />)
        expect(hasReducedMotionListener.current).toBe(false)
        unmount1()

        // Then render with "user" - should initialize listener
        hasReducedMotionListener.current = false
        render(<ComponentWithUser />)
        expect(hasReducedMotionListener.current).toBe(true)
    })
})
