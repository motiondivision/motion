import { createRef } from "react"
import { frame, motionValue } from "motion-dom"
import { motion } from "../../render/components/motion"
import { useTransform } from "../use-transform"
import { render } from "../../jest.setup"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

describe("useTransform on re-render", () => {
    test("doesn't subscribe to its source again", () => {
        const source = motionValue(0)
        const on = jest.spyOn(source, "on")
        const Component = () => {
            const x = useTransform(source, [0, 1], [0, 100])
            return <motion.div style={{ x }} />
        }

        const { rerender } = render(<Component />)
        const subscriptions = on.mock.calls.length
        rerender(<Component />)
        rerender(<Component />)

        expect(on.mock.calls.length).toBe(subscriptions)
    })

    test("re-subscribes when its source changes", async () => {
        const a = motionValue(0)
        const b = motionValue(1)
        const ref = createRef<HTMLDivElement>()
        const Component = ({ source }: { source: typeof a }) => {
            const opacity = useTransform(source, [0, 1], [0, 1])
            return <motion.div ref={ref} style={{ opacity }} />
        }

        const { rerender } = render(<Component source={a} />)
        rerender(<Component source={b} />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("1")

        a.set(0.5)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("1")

        b.set(0.25)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.25")
    })
})

describe("useTransform ranges written inline", () => {
    test("don't rebuild the transformer while they hold the same values", () => {
        const motionDom = require("motion-dom")
        const transform = jest.spyOn(motionDom, "transform")
        const source = motionValue(0.5)
        const Component = () => {
            const x = useTransform(source, [0, 1], [0, 100])
            return <motion.div style={{ x }} />
        }
        const { rerender } = render(<Component />)
        const calls = transform.mock.calls.length
        rerender(<Component />)
        rerender(<Component />)

        expect(transform.mock.calls.length).toBe(calls)
        transform.mockRestore()
    })

    test("use new ranges when they change", async () => {
        const source = motionValue(0.5)
        const ref = createRef<HTMLDivElement>()
        const Component = ({ max }: { max: number }) => {
            const opacity = useTransform(source, [0, 1], [0, max])
            return <motion.div ref={ref} style={{ opacity }} />
        }
        const { rerender } = render(<Component max={1} />)
        rerender(<Component max={0.5} />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.25")
    })
})
