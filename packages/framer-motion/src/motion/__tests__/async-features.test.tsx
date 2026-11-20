import { motionValue, visualElementStore } from "motion-dom"
import { act } from "react"
import { nextFrame } from "../../gestures/__tests__/utils"
import { pointerEnter, render } from "../../jest.setup"
import { featureLoaders } from "../../render/components/motion-async/loaders"
import {
    motion,
    preloadFeatures,
} from "../../render/components/motion-async/proxy"

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

const projectionOf = (element: Element) =>
    visualElementStore.get(element)!.projection

const instant = { duration: 0 }

/**
 * Tests run in order and share the loaders, as an app's components do.
 */
describe("motion components with async layout and drag", () => {
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

    test("animates on mount without a fetch", async () => {
        const { container } = render(
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={instant}
            />
        )
        const element = container.firstChild as HTMLElement
        expect(element.style.opacity).toBe("0")

        await act(nextFrame)

        expect(element.style.opacity).toBe("1")
        expect(loaded()).toEqual([])
    })

    test("animates a change to animate after initial={false}", async () => {
        const Component = ({ x }: { x: number }) => (
            <motion.div initial={false} animate={{ x }} transition={instant} />
        )
        const { container, rerender } = render(<Component x={100} />)
        const element = container.firstChild as HTMLElement
        expect(element.style.transform).toBe("translateX(100px)")

        rerender(<Component x={200} />)
        await act(nextFrame)

        expect(element.style.transform).toBe("translateX(200px)")
    })

    test("gestures work from the first render", async () => {
        const onHoverStart = jest.fn()
        const { container } = render(
            <motion.div
                onHoverStart={onHoverStart}
                whileHover={{ opacity: 0.5 }}
                transition={instant}
            />
        )
        const element = container.firstChild as HTMLElement

        pointerEnter(element)
        await act(nextFrame)

        expect(onHoverStart).toHaveBeenCalledTimes(1)
        expect(element.style.opacity).toBe("0.5")
        expect(loaded()).toEqual([])
    })

    test("a failed fetch doesn't throw, and a later render asks again", async () => {
        const { load } = featureLoaders.layout
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
        const unhandled = jest.fn()
        process.on("unhandledRejection", unhandled)

        featureLoaders.layout.load = jest.fn(() =>
            Promise.reject(new Error("offline"))
        )

        const { container, rerender } = render(<motion.div layout />)
        await settle()

        expect(featureLoaders.layout.load).toHaveBeenCalledTimes(1)
        expect(loaded()).toEqual([])
        expect(projectionOf(container.firstChild as Element)).toBeUndefined()

        /**
         * Not asked for again straight away.
         */
        rerender(<motion.div layout />)
        await settle()
        expect(featureLoaders.layout.load).toHaveBeenCalledTimes(1)

        /**
         * Asked for again once it has been left a while.
         */
        featureLoaders.layout.failedAt = 0
        featureLoaders.layout.load = load
        rerender(<motion.div layout />)
        await settle()

        expect(loaded()).toEqual(["layout"])
        expect(projectionOf(container.firstChild as Element)).toBeTruthy()
        expect(unhandled).not.toHaveBeenCalled()

        process.off("unhandledRejection", unhandled)
        warn.mockRestore()
    })

    test("preloadFeatures fetches what isn't loaded yet", async () => {
        expect(loaded()).toEqual(["layout"])

        await act(async () => {
            await preloadFeatures()
        })

        expect(loaded()).toEqual(["layout", "drag"])
    })

    test("drag works once loaded", async () => {
        const { container } = render(<motion.div drag />)
        await settle()

        expect(
            visualElementStore.get(container.firstChild as Element)!.features
                .drag
        ).toBeTruthy()
    })
})
