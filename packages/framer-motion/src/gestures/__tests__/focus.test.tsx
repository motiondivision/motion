import { createRef } from "react"
import { frame, motion, motionValue } from "../../"
import { blur, focus, render } from "../../jest.setup"
import { nextFrame } from "./utils"

describe("focus", () => {
    test("whileFocus applied", async () => {
        const promise = new Promise(async (resolve) => {
            const opacity = motionValue(1)
            const ref = createRef<HTMLAnchorElement>()
            const Component = () => (
                <motion.a
                    ref={ref}
                    data-testid="myAnchorElement"
                    href="#"
                    whileFocus={{ opacity: 0.1 }}
                    transition={{ type: false }}
                    style={{ opacity }}
                ></motion.a>
            )

            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            ref.current!.matches = () => true

            focus(container, "myAnchorElement")

            await nextFrame()

            resolve(opacity.get())
        })

        return expect(promise).resolves.toBe(0.1)
    })

    test("whileFocus not applied when :focus-visible is false", async () => {
        const promise = new Promise((resolve) => {
            const opacity = motionValue(1)
            const ref = createRef<HTMLAnchorElement>()
            const Component = () => (
                <motion.a
                    ref={ref}
                    data-testid="myAnchorElement"
                    href="#"
                    whileFocus={{ opacity: 0.1 }}
                    transition={{ type: false }}
                    style={{ opacity }}
                ></motion.a>
            )

            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            ref.current!.matches = () => false

            focus(container, "myAnchorElement")

            resolve(opacity.get())
        })

        return expect(promise).resolves.toBe(1)
    })

    test("whileFocus applied if focus-visible selector throws unsupported", async () => {
        const promise = new Promise(async (resolve) => {
            const opacity = motionValue(1)
            const ref = createRef<HTMLAnchorElement>()
            const Component = () => (
                <motion.a
                    ref={ref}
                    data-testid="myAnchorElement"
                    href="#"
                    whileFocus={{ opacity: 0.1 }}
                    transition={{ type: false }}
                    style={{ opacity }}
                ></motion.a>
            )

            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            ref.current!.matches = () => {
                /**
                 * Explicitly throw as while Jest throws we want to ensure this
                 * behaviour isn't silently fixed should it fix this in the future.
                 */
                throw new Error("this selector not supported")
            }

            focus(container, "myAnchorElement")

            await nextFrame()

            resolve(opacity.get())
        })

        return expect(promise).resolves.toBe(0.1)
    })

    test("whileFocus applied as variant", async () => {
        const target = 0.5
        const promise = new Promise(async (resolve) => {
            const variant = {
                hidden: { opacity: target },
            }
            const ref = createRef<HTMLAnchorElement>()
            const opacity = motionValue(1)
            const Component = () => (
                <motion.a
                    ref={ref}
                    data-testid="myAnchorElement"
                    href="#"
                    whileFocus="hidden"
                    variants={variant}
                    transition={{ type: false }}
                    style={{ opacity }}
                ></motion.a>
            )

            const { container, rerender } = render(<Component />)
            rerender(<Component />)

            ref.current!.matches = () => true

            focus(container, "myAnchorElement")

            await nextFrame()

            resolve(opacity.get())
        })

        return expect(promise).resolves.toBe(target)
    })

    test("whileFocus is unapplied when blur", () => {
        const promise = new Promise(async (resolve) => {
            const ref = createRef<HTMLAnchorElement>()
            const variant = {
                hidden: { opacity: 0.5, transitionEnd: { opacity: 0.75 } },
            }
            const opacity = motionValue(1)

            let blurred = false
            const onComplete = () => {
                frame.postRender(() => blurred && resolve(opacity.get()))
            }

            const Component = ({ onAnimationComplete }: any) => (
                <motion.a
                    ref={ref}
                    data-testid="myAnchorElement"
                    href="#"
                    whileFocus="hidden"
                    variants={variant}
                    transition={{ type: false }}
                    style={{ opacity }}
                    onAnimationComplete={onAnimationComplete}
                ></motion.a>
            )

            const { container } = render(
                <Component onAnimationComplete={onComplete} />
            )

            ref.current!.matches = () => true

            focus(container, "myAnchorElement")
            await nextFrame()
            setTimeout(() => {
                blurred = true
                blur(container, "myAnchorElement")
            }, 10)
        })

        return expect(promise).resolves.toBe(1)
    })
})
