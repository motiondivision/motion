import { motionValue, visualElementStore } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { act } from "react"
import { nextFrame } from "../../gestures/__tests__/utils"
import { pointerEnter, render } from "../../jest.setup"
import { featureLoaders } from "../../render/components/motion-async/loaders"
import { motion } from "../../render/components/motion-async/proxy"

const loaded = () =>
    Object.keys(featureLoaders).filter((name) => featureLoaders[name].isLoaded)

/**
 * Let pending import()s resolve and the components render again.
 */
const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

/**
 * Tests run in order and share the loaders, as an app's components do.
 */
describe("motion components with async features", () => {
    beforeEach(() => {
        MotionGlobalConfig.instantAnimations = true
    })
    afterEach(() => {
        MotionGlobalConfig.instantAnimations = false
    })

    test("renders motion value changes without loading a feature", async () => {
        const x = motionValue(0)
        const { container } = render(<motion.div style={{ x }} />)
        await settle()
        const element = container.firstChild as HTMLElement

        x.set(100)
        await act(nextFrame)

        expect(element.style.transform).toBe("translateX(100px)")
        expect(loaded()).toEqual([])
    })

    test("initial renders before the animation feature arrives", async () => {
        const { container } = render(
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        )
        const element = container.firstChild as HTMLElement
        expect(element.style.opacity).toBe("0")
        expect(loaded()).toEqual([])

        await settle()
        await act(nextFrame)

        expect(loaded()).toEqual(["animation"])
        expect(element.style.opacity).toBe("1")
    })

    test("animates prop changes once loaded", async () => {
        const Component = ({ x }: { x: number }) => (
            <motion.div animate={{ x }} />
        )
        const { container, rerender } = render(<Component x={0} />)
        await settle()
        rerender(<Component x={50} />)
        await act(nextFrame)

        expect((container.firstChild as HTMLElement).style.transform).toBe(
            "translateX(50px)"
        )
    })

    test("an event handler loads gestures", async () => {
        const onHoverStart = jest.fn()
        const { container } = render(
            <motion.div onHoverStart={onHoverStart} />
        )
        await settle()

        expect(loaded()).toEqual(["animation", "gestures"])
        pointerEnter(container.firstChild as Element)
        await act(nextFrame)
        expect(onHoverStart).toHaveBeenCalled()
    })

    test("whileHover animates once gestures arrive", async () => {
        const { container } = render(
            <motion.div whileHover={{ opacity: 0.5 }} />
        )
        await settle()
        const element = container.firstChild as HTMLElement

        pointerEnter(element)
        await act(nextFrame)
        await act(nextFrame)
        expect(element.style.opacity).toBe("0.5")
    })

    test("layout loads the layout feature and makes a projection node", async () => {
        const { container } = render(<motion.div layout />)
        const element = container.firstChild as HTMLElement
        expect(visualElementStore.get(element)!.projection).toBeFalsy()

        await settle()

        expect(loaded()).toEqual(["animation", "gestures", "layout"])
        expect(visualElementStore.get(element)!.projection).toBeTruthy()
    })

    test("drag loads the drag feature", async () => {
        const { container } = render(<motion.div drag />)
        await settle()
        const element = container.firstChild as HTMLElement

        expect(loaded()).toEqual(["animation", "gestures", "layout", "drag"])
        expect(visualElementStore.get(element)!.projection).toBeTruthy()
    })
})
