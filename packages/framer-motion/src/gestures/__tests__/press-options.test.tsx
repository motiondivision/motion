import { motionValue } from "motion-dom"
import { motion } from "../.."
import { pointerDown, pointerUp, render } from "../../jest.setup"
import { nextFrame, stepFrames, withManualFrames } from "./utils"

describe("tap prop", () => {
    withManualFrames()

    test("times: onTapStart fires on the first press, onTap on the second", async () => {
        const onTapStart = jest.fn()
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const opacity = motionValue(0.5)
        const history: number[] = []
        opacity.on("change", (v) => history.push(v))

        const { container } = render(
            <motion.div
                tap={{ times: 2 }}
                initial={{ opacity: 0.5 }}
                transition={{ type: false }}
                whileTap={{ opacity: 1 }}
                style={{ opacity }}
                onTapStart={onTapStart}
                onTap={onTap}
                onTapCancel={onTapCancel}
            />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        await stepFrames(50)
        expect(onTapStart).toHaveBeenCalledTimes(1)
        expect(opacity.get()).toBe(1)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).not.toHaveBeenCalled()

        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(onTapStart).toHaveBeenCalledTimes(1)
        expect(onTap).toHaveBeenCalledTimes(1)
        expect(onTapCancel).not.toHaveBeenCalled()
        // No flicker: whileTap stays on across the sequence
        expect(history).toEqual([1, 0.5])
    })

    test("times: an unfinished sequence fires onTapCancel", async () => {
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const opacity = motionValue(0.5)
        const { container } = render(
            <motion.div
                tap={{ times: 2 }}
                initial={{ opacity: 0.5 }}
                transition={{ type: false }}
                whileTap={{ opacity: 1 }}
                style={{ opacity }}
                onTap={onTap}
                onTapCancel={onTapCancel}
            />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(opacity.get()).toBe(1)

        await stepFrames(400)
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        expect(onTap).not.toHaveBeenCalled()
        expect(opacity.get()).toBe(0.5)
    })

    test("after: whileTap and onTapStart fire on press, onTap after the hold", async () => {
        const onTapStart = jest.fn()
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const opacity = motionValue(0.5)
        const { container } = render(
            <motion.div
                tap={{ after: 0.5 }}
                initial={{ opacity: 0.5 }}
                transition={{ type: false }}
                whileTap={{ opacity: 1 }}
                style={{ opacity }}
                onTapStart={onTapStart}
                onTap={onTap}
                onTapCancel={onTapCancel}
            />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        await stepFrames(50)
        expect(opacity.get()).toBe(1)
        expect(onTapStart).toHaveBeenCalledTimes(1)

        await stepFrames(550)
        pointerUp(element)
        await stepFrames(50)
        expect(opacity.get()).toBe(0.5)
        expect(onTap).toHaveBeenCalledTimes(1)
        expect(onTapCancel).not.toHaveBeenCalled()
    })

    test("after: early release fires onTapCancel", async () => {
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const opacity = motionValue(0.5)
        const { container } = render(
            <motion.div
                tap={{ after: 0.5 }}
                initial={{ opacity: 0.5 }}
                transition={{ type: false }}
                whileTap={{ opacity: 1 }}
                style={{ opacity }}
                onTap={onTap}
                onTapCancel={onTapCancel}
            />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        await stepFrames(250)
        expect(opacity.get()).toBe(1)
        pointerUp(element)
        await stepFrames(50)
        expect(opacity.get()).toBe(0.5)
        expect(onTap).not.toHaveBeenCalled()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
    })

    test("repeat: onTap fires per repeat while whileTap stays active", async () => {
        const onTapStart = jest.fn()
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const opacity = motionValue(0.5)
        const history: number[] = []
        opacity.on("change", (v) => history.push(v))

        const { container } = render(
            <motion.div
                tap={{ repeat: 0.1 }}
                initial={{ opacity: 0.5 }}
                transition={{ type: false }}
                whileTap={{ opacity: 1 }}
                style={{ opacity }}
                onTapStart={onTapStart}
                onTap={onTap}
                onTapCancel={onTapCancel}
            />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        await stepFrames(350)
        expect(onTapStart).toHaveBeenCalledTimes(1)
        expect(onTap).toHaveBeenCalledTimes(3)
        // No flicker: whileTap only switched on once
        expect(history).toEqual([1])

        pointerUp(element)
        await stepFrames(300)
        expect(onTap).toHaveBeenCalledTimes(4)
        expect(onTapCancel).not.toHaveBeenCalled()
        expect(history).toEqual([1, 0.5])
    })

    test("repeat doesn't fire onTap on a disabled button", async () => {
        const onTap = jest.fn()
        const { container } = render(
            <motion.button disabled tap={{ repeat: 0.1 }} onTap={onTap} />
        )
        const element = container.firstChild as Element

        pointerDown(element)
        await stepFrames(350)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).not.toHaveBeenCalled()
    })

    test("changing tap options between renders takes effect", async () => {
        const onTap = jest.fn()
        const Component = ({ times }: { times?: number }) => (
            <motion.div tap={times ? { times } : undefined} onTap={onTap} />
        )
        const { container, rerender } = render(<Component />)
        const element = container.firstChild as Element

        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).toHaveBeenCalledTimes(1)

        rerender(<Component times={2} />)
        await nextFrame()
        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).toHaveBeenCalledTimes(1)
        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).toHaveBeenCalledTimes(2)

        rerender(<Component />)
        await nextFrame()
        await stepFrames(500)
        pointerDown(element)
        pointerUp(element)
        await stepFrames(50)
        expect(onTap).toHaveBeenCalledTimes(3)
    })

    test("tap isn't passed to the DOM", () => {
        const { container } = render(
            <motion.div tap={{ times: 2 }} onTap={() => {}} />
        )
        expect((container.firstChild as Element).hasAttribute("tap")).toBe(
            false
        )
    })
})
