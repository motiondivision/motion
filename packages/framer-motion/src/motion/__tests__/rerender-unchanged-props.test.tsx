import { act, createRef } from "react"
import { motionValue, visualElementStore } from "motion-dom"
import { motion } from "../../render/components/motion"
import { AnimatePresence } from "../../components/AnimatePresence"
import { useTransform } from "../../value/use-transform"
import { MotionConfig } from "../../components/MotionConfig"
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

    test("still writes values set during the parent's render", async () => {
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
        await nextFrame()
        expect(ref.current!.style.opacity).toBe("0.25")
    })

    test("layout components render with every parent render", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = () => <motion.div ref={ref} layout />
        const { rerender } = render(<Component />)
        await nextFrame()
        const ve = visualElementStore.get(ref.current!)!
        const update = jest.spyOn(ve, "update")
        rerender(<Component />)
        expect(update).toHaveBeenCalled()
    })

    test("static components render when their motion values change", async () => {
        const x = motionValue(10)
        const ref = createRef<HTMLDivElement>()
        const Component = () => <motion.div ref={ref} style={{ x }} />
        render(
            <MotionConfig isStatic>
                <Component />
            </MotionConfig>
        )
        await act(async () => x.set(20))
        expect(ref.current!.style.transform).toBe("translateX(20px)")
    })
})
