import { motionValue } from "motion-dom"
import { LazyMotion, domAnimation, domMax, m, motion } from "../.."
import { render } from "../../jest.setup"

describe("Lazy feature loading", () => {
    test("Doesn't animate without loaded features", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <m.div
                    animate={{ x: 20 }}
                    transition={{ duration: 0.01 }}
                    style={{ x }}
                    onAnimationComplete={onComplete}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
            setTimeout(() => resolve(x.get()), 50)
        })

        return expect(promise).resolves.not.toBe(20)
    })

    test("Does animate with synchronously-loaded domAnimation", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion features={domAnimation}>
                    <m.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("Does animate with synchronously-loaded domMax", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion features={domMax}>
                    <m.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("Supports nested feature sets", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion features={domMax}>
                    <m.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("Doesn't throw without strict mode", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion features={domMax}>
                    <motion.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("Throws in strict mode", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion features={domMax} strict>
                    <motion.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).rejects.toThrowError()
    })

    test("Animates after async loading", async () => {
        const promise = new Promise((resolve) => {
            const x = motionValue(0)
            const onComplete = () => resolve(x.get())

            const Component = () => (
                <LazyMotion
                    features={() =>
                        import("./lazy-async-endpoint").then(
                            ({ domAnimation: features }: any) => features
                        )
                    }
                    strict
                >
                    <m.div
                        animate={{ x: 20 }}
                        transition={{ duration: 0.01 }}
                        style={{ x }}
                        onAnimationComplete={onComplete}
                    />
                </LazyMotion>
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        return expect(promise).resolves.toBe(20)
    })

    test("A failed async load doesn't cause an unhandled rejection", async () => {
        const onUnhandled = jest.fn()
        process.on("unhandledRejection", onUnhandled)

        const { container } = render(
            <LazyMotion
                features={() => Promise.reject(new Error("Failed to load"))}
            >
                <m.div animate={{ opacity: 0.5 }}>Hello</m.div>
            </LazyMotion>
        )

        await new Promise((resolve) => setTimeout(resolve, 20))
        process.off("unhandledRejection", onUnhandled)

        expect(onUnhandled).not.toHaveBeenCalled()
        expect(container.textContent).toBe("Hello")
    })
})
