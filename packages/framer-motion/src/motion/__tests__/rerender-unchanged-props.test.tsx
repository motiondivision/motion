import { act, createRef, StrictMode, useState } from "react"
import {
    frame,
    motionValue,
    VisualElement,
    visualElementStore,
} from "motion-dom"
import { motion } from "../../render/components/motion"
import { AnimatePresence } from "../../components/AnimatePresence"
import { useTransform } from "../../value/use-transform"
import { render } from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

/**
 * A parent re-rendering a motion component with props equal to the last
 * render's (inline objects included) has nothing to update, so the element
 * skips its prop update, feature update, animation diff and full render.
 */
describe("re-rendering with unchanged props", () => {
    afterEach(() => jest.restoreAllMocks())

    test("skips the element's update, features and animations", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => (
            <motion.div
                ref={ref}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ x: 10, backgroundColor: "red" }}
                transition={{ duration: 0.01 }}
            />
        )

        const { rerender } = render(<Component />)
        rerender(<Component />)
        await nextFrame()

        const ve = visualElementStore.get(ref.current!)!
        const update = jest.spyOn(ve, "update")
        const updateFeatures = jest.spyOn(ve, "updateFeatures")
        const render_ = jest.spyOn(ve, "render")
        const animateChanges = jest.spyOn(ve.animationState!, "animateChanges")

        rerender(<Component />)
        rerender(<Component />)
        await nextFrame()

        expect(update).not.toHaveBeenCalled()
        expect(updateFeatures).not.toHaveBeenCalled()
        expect(render_).not.toHaveBeenCalled()
        expect(animateChanges).not.toHaveBeenCalled()
    })

    test("still updates when a prop changes", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = ({ opacity }: { opacity: number }) => (
            <motion.div
                ref={ref}
                animate={{ opacity }}
                transition={{ type: false }}
                style={{ backgroundColor: "red" }}
            />
        )

        const { rerender } = render(<Component opacity={1} />)
        rerender(<Component opacity={1} />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("1")

        rerender(<Component opacity={0.5} />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.5")
    })

    test("still updates when a nested value changes", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = ({ color }: { color: string }) => (
            <motion.div ref={ref} style={{ backgroundColor: color }} />
        )

        const { rerender } = render(<Component color="red" />)
        rerender(<Component color="blue" />)
        await nextFrame()
        expect(ref.current!.style.backgroundColor).toBe("blue")
    })

    test("picks up a new event handler", async () => {
        const x = motionValue(0)
        const first = jest.fn()
        const second = jest.fn()
        const Component = ({
            target,
            onComplete,
        }: {
            target: number
            onComplete: () => void
        }) => (
            <motion.div
                animate={{ x: target }}
                style={{ x }}
                transition={{ type: false }}
                onAnimationComplete={onComplete}
            />
        )

        const { rerender } = render(
            <Component target={10} onComplete={first} />
        )
        rerender(<Component target={10} onComplete={first} />)
        await nextFrame()
        expect(first).toHaveBeenCalledTimes(1)

        rerender(<Component target={20} onComplete={second} />)
        await nextFrame()
        expect(x.get()).toBe(20)
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
    })

    test("still animates when only the parent's variant changes", async () => {
        const ref = createRef<HTMLDivElement>()
        const Child = () => (
            <motion.div
                ref={ref}
                variants={{ a: { opacity: 1 }, b: { opacity: 0.5 } }}
                transition={{ type: false }}
            />
        )
        const Parent = ({ label }: { label: string }) => (
            <motion.div animate={label}>
                <Child />
            </motion.div>
        )

        const { rerender } = render(<Parent label="a" />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("1")

        rerender(<Parent label="b" />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.5")
    })

    test("still exits when only presence changes", async () => {
        const x = motionValue(0)
        const Component = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        key="a"
                        exit={{ x: 100 }}
                        style={{ x }}
                        transition={{ type: false }}
                    />
                )}
            </AnimatePresence>
        )

        const { rerender } = render(<Component isVisible />)
        rerender(<Component isVisible />)
        await act(async () => {
            rerender(<Component isVisible={false} />)
        })
        await nextFrame()

        expect(x.get()).toBe(100)
    })

    test("still writes values set during the render before the next frame", async () => {
        const source = motionValue(0.5)
        const ref = createRef<HTMLDivElement>()
        const Component = ({ max }: { max: number }) => {
            const opacity = useTransform(source, [0, 1], [0, max])
            return <motion.div ref={ref} style={{ opacity }} />
        }

        const { rerender } = render(<Component max={1} />)
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.5")

        rerender(<Component max={0.5} />)
        await Promise.resolve()
        expect(ref.current!.style.opacity).toBe("0.25")
    })
})

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

describe("unmounting idle motion values", () => {
    test("schedules no frame work per value", () => {
        const read = jest.spyOn(frame, "read")
        const List = ({ isVisible }: { isVisible: boolean }) => {
            const [values] = useState(() =>
                Array.from({ length: 10 }, () => motionValue(0))
            )
            return isVisible ? (
                <>
                    {values.map((x, i) => (
                        <motion.div key={i} style={{ x }} />
                    ))}
                </>
            ) : null
        }

        const { rerender } = render(<List isVisible />)
        read.mockClear()
        rerender(<List isVisible={false} />)

        expect(read).not.toHaveBeenCalled()
    })
})

describe("effects that run again without a render", () => {
    /**
     * Strict Mode runs a commit's effects twice, and a revealed <Activity>
     * runs them again, without a render. What's on screen may have been
     * reset, so each run renders in full rather than being skipped as an
     * unchanged commit.
     */
    test("render in full each time under Strict Mode", async () => {
        const scheduleRender = jest.spyOn(
            VisualElement.prototype,
            "scheduleRenderMicrotask"
        )
        render(
            <StrictMode>
                <motion.div animate={{ x: 100 }} />
            </StrictMode>
        )
        await nextFrame()

        expect(scheduleRender).toHaveBeenCalledTimes(2)
        scheduleRender.mockRestore()
    })
})
