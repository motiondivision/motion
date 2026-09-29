import { frame, motionValue, MotionValue } from "motion-dom"
import { act, useEffect } from "react"
import { render } from "../../jest.setup"
import { motion } from "../../render/components/motion"
import { MotionConfig } from "../../components/MotionConfig"
import { useMotionValueEvent } from "../../utils/use-motion-value-event"
import { useMotionTemplate } from "../use-motion-template"
import { useMotionValue } from "../use-motion-value"
import { useTransform } from "../use-transform"

/**
 * Transforms are lazy: they only subscribe to their inputs while they have
 * their own `change` subscribers, and otherwise compute themselves when read.
 */

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const changeSubscribers = (value: MotionValue) =>
    value["events"].change?.getSize() ?? (value["changeSubscriber"] ? 1 : 0)

describe("lazy transforms", () => {
    test("an unsubscribed transform doesn't subscribe to its input", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()

        expect(changeSubscribers(x)).toBe(0)
        expect(y.get()).toBe(2)

        unmount()
    })

    test("an unsubscribed transform reads its input when read, without waiting for a frame", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, [0, 10], [0, 100])
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()

        x.set(5)
        expect(y.get()).toBe(50)

        unmount()
    })

    test("a subscribed transform updates in the next frame, as before", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        const latest: number[] = []
        const unsubscribe = y.on("change", (v) => latest.push(v))
        expect(changeSubscribers(x)).toBe(1)

        x.set(5)
        expect(y.get()).toBe(2)
        await nextFrame()
        expect(y.get()).toBe(10)
        expect(latest).toEqual([10])

        unsubscribe()
        unmount()
    })

    test("a new subscriber catches up without being called, then follows", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()
        x.set(3)
        await nextFrame()

        const latest: number[] = []
        const unsubscribe = y.on("change", (v) => latest.push(v))
        expect(latest).toEqual([])
        expect(y.get()).toBe(6)

        x.set(4)
        await nextFrame()
        expect(latest).toEqual([8])

        unsubscribe()
        unmount()
    })

    test("unsubscribes from its input a frame after its last subscriber leaves", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        const unsubscribe = y.on("change", () => {})
        expect(changeSubscribers(x)).toBe(1)

        unsubscribe()
        await nextFrame()
        await nextFrame()
        expect(changeSubscribers(x)).toBe(0)

        x.set(7)
        expect(y.get()).toBe(14)

        unmount()
    })

    test("the first getVelocity() of an unsubscribed transform is 0, then it's tracked", async () => {
        const x = motionValue(0)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()

        x.set(100)
        await nextFrame()
        x.set(200)
        await nextFrame()
        expect(y.getVelocity()).toBe(0)

        x.set(300)
        await nextFrame()
        x.set(400)
        await nextFrame()
        expect(y.getVelocity()).toBeGreaterThan(0)

        unmount()
    })

    test("velocity of a subscribed transform is live from the first read", async () => {
        const x = motionValue(0)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            useMotionValueEvent(y, "change", () => {})
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()

        x.set(100)
        await nextFrame()
        x.set(200)
        await nextFrame()
        expect(y.getVelocity()).toBeGreaterThan(0)

        unmount()
    })

    test("a set() on an unsubscribed transform is replaced when it's next read", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()

        y.set(100)
        expect(y.get()).toBe(2)

        unmount()
    })

    test("a subscribed transform updates during render when its output range changes", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = ({ max }: { max: number }) => {
            y = useTransform(x, [0, 1], [0, max])
            return null
        }
        const { rerender, unmount } = render(<Component max={10} />)
        const unsubscribe = y.on("change", () => {})
        expect(y.get()).toBe(10)

        rerender(<Component max={20} />)
        expect(y.get()).toBe(20)

        unsubscribe()
        unmount()
    })

    test("a subscribed transform follows a new input after a rerender", async () => {
        const a = motionValue(1)
        const b = motionValue(2)
        let y!: MotionValue<number>
        const Component = ({ input }: { input: MotionValue<number> }) => {
            y = useTransform(input, (v) => v * 10)
            return null
        }
        const { rerender, unmount } = render(<Component input={a} />)
        const latest: number[] = []
        const unsubscribe = y.on("change", (v) => latest.push(v))

        rerender(<Component input={b} />)
        expect(changeSubscribers(a)).toBe(0)
        expect(changeSubscribers(b)).toBe(1)

        b.set(3)
        await nextFrame()
        a.set(4)
        await nextFrame()
        expect(y.get()).toBe(30)
        expect(latest).toEqual([20, 30])

        unsubscribe()
        unmount()
    })

    test("a subscribed transform stops following its input after unmount", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        const latest: number[] = []
        const unsubscribe = y.on("change", (v) => latest.push(v))

        unmount()
        expect(changeSubscribers(x)).toBe(0)
        x.set(5)
        await nextFrame()
        expect(latest).toEqual([])

        unsubscribe()
    })

    test("an unsubscribed transform still reads its input after unmount", async () => {
        const x = motionValue(1)
        let y!: MotionValue<number>
        const Component = () => {
            y = useTransform(x, (v) => v * 2)
            return null
        }
        const { unmount } = render(<Component />)
        unmount()

        x.set(5)
        await nextFrame()
        expect(y.get()).toBe(10)
    })

    test("StrictMode: a subscribed transform subscribes to its input once, and leaves it on unmount", async () => {
        const x = motionValue(1)
        const latest: number[] = []
        const Component = () => {
            const y = useTransform(x, (v) => v * 2)
            useMotionValueEvent(y, "change", (v) => latest.push(v))
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()
        expect(changeSubscribers(x)).toBe(1)

        x.set(2)
        await nextFrame()
        expect(latest).toEqual([4])

        unmount()
        await nextFrame()
        await nextFrame()
        expect(changeSubscribers(x)).toBe(0)
    })

    test("nested, function and template transforms stay unsubscribed until the outermost is subscribed", async () => {
        const x = motionValue(1)
        let outer!: MotionValue<string>
        const Component = () => {
            const doubled = useTransform(x, (v) => v * 2)
            const plusOne = useTransform(() => doubled.get() + 1)
            outer = useMotionTemplate`${plusOne}px`
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()
        expect(changeSubscribers(x)).toBe(0)

        x.set(2)
        expect(outer.get()).toBe("5px")

        const latest: string[] = []
        const unsubscribe = outer.on("change", (v) => latest.push(v))
        expect(changeSubscribers(x)).toBeGreaterThan(0)
        x.set(3)
        await nextFrame()
        expect(latest).toEqual(["7px"])

        unsubscribe()
        unmount()
    })

    test("a style bound to a transform follows its input", async () => {
        const x = motionValue(0)
        const Component = () => {
            const y = useTransform(x, (v) => v * 2)
            return <motion.div data-testid="box" style={{ y }} />
        }
        const { getByTestId, unmount } = render(<Component />)
        await act(async () => {
            x.set(10)
            await nextFrame()
        })
        expect(getByTestId("box")).toHaveStyle("transform: translateY(20px)")

        unmount()
    })

    test("a transform in static mode rerenders when its input changes", async () => {
        const Component = () => {
            const x = useMotionValue(10)
            const y = useTransform(x, (v) => v * 2)
            useEffect(() => x.set(20), [x])
            return <motion.div data-testid="box" style={{ x: y }} />
        }
        const { getByTestId, unmount } = render(
            <MotionConfig isStatic>
                <Component />
            </MotionConfig>
        )
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 40))
        })
        expect(getByTestId("box")).toHaveStyle("transform: translateX(40px)")

        unmount()
    })
})
