import { MotionValue, motionValue } from "motion-dom"
import { useEffect } from "react"
import { motion } from "../../"
import { nextMicrotask } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"
import { useMotionTemplate } from "../use-motion-template"
import { useMotionValue } from "../use-motion-value"

describe("useMotionTemplate", () => {
    test("sets initial value", async () => {
        const Component = () => {
            const x = useMotionValue(1)
            const y = useMotionValue(2)
            const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px)`
            return <motion.div style={{ transform }} />
        }

        const { container } = render(<Component />)

        expect(container.firstChild).toHaveStyle(
            `transform: translateX(1px) translateY(2px)`
        )
    })

    test("responds to manual setting from parent value", async () => {
        const Component = () => {
            const x = useMotionValue(1)
            const y = useMotionValue(2)
            const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px)`

            useEffect(() => {
                x.set(10)
            }, [])

            return <motion.div style={{ transform }} />
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)
        const { firstChild } = container

        return new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                expect(firstChild).toHaveStyle(
                    `transform: translateX(10px) translateY(2px)`
                )
                resolve()
            })
        })
    })

    test("can be re-pointed to another `MotionValue`", async () => {
        const a = motionValue(1)
        const b = motionValue(2)
        const Component = ({ value }: { value: MotionValue }) => {
            const transform = useMotionTemplate`translateX(${value}px)`
            return <motion.div style={{ transform }} />
        }

        const { container, rerender } = render(<Component value={a} />)

        expect(container.firstChild).toHaveStyle(`transform: translateX(1px)`)

        rerender(<Component value={b} />)

        await nextMicrotask()

        expect(container.firstChild).toHaveStyle(`transform: translateX(2px)`)
    })

    test("respects static values", async () => {
        const Component = ({ y }: { y: number }) => {
            const x = useMotionValue(1)
            const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px)`
            return <motion.div style={{ transform }} />
        }

        const { container, rerender } = render(<Component y={1} />)

        expect(container.firstChild).toHaveStyle(
            `transform: translateX(1px) translateY(1px)`
        )
        rerender(<Component y={2} />)
        await nextMicrotask()
        expect(container.firstChild).toHaveStyle(
            `transform: translateX(1px) translateY(2px)`
        )
    })
})
