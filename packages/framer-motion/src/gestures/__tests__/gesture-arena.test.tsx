import { isGestureActive } from "motion-dom"
import { motion, motionValue } from "../../"
import { render } from "../../jest.setup"
import { drag, MockDrag } from "../drag/__tests__/utils"
import { nextFrame } from "./utils"

describe("gesture arena", () => {
    test("dragging a parent cancels a child's tap and resets whileTap", async () => {
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const scale = motionValue(1)
        const Component = () => (
            <MockDrag>
                <motion.div drag>
                    <motion.button
                        whileTap={{ scale: 0.5 }}
                        transition={{ duration: 0 }}
                        style={{ scale }}
                        onTap={onTap}
                        onTapCancel={onTapCancel}
                    />
                </motion.div>
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)
        const parent = container.firstChild as Element
        const button = parent.firstChild as Element

        const pointer = await drag(parent, button).to(100, 100)
        await nextFrame()

        expect(onTapCancel).toBeCalledTimes(1)
        expect(scale.get()).toBe(1)
        expect(isGestureActive("drag", parent)).toBe(true)

        pointer.end()
        await nextFrame()

        expect(onTap).not.toBeCalled()
        expect(scale.get()).toBe(1)
        expect(isGestureActive()).toBe(false)
    })

    test("dragging an element ends its own tap as a cancel", async () => {
        const onTap = jest.fn()
        const onTapCancel = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div drag onTap={onTap} onTapCancel={onTapCancel} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)
        expect(onTapCancel).not.toBeCalled()

        pointer.end()
        await nextFrame()

        expect(onTap).not.toBeCalled()
        expect(onTapCancel).toBeCalledTimes(1)
    })

    test("dragAfter lets touches scroll until the hold passes", () => {
        const { container } = render(<motion.div drag="y" dragAfter={0.3} />)
        expect((container.firstChild as HTMLElement).style.touchAction).toBe(
            "manipulation"
        )
    })
})
