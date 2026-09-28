import { frame, MotionValue } from "motion-dom"
import { act, useEffect } from "react"
import { click, render } from "../../jest.setup"
import { useMotionValueEvent } from "../../utils/use-motion-value-event"
import { useScroll } from "../use-scroll"
import { useTransform } from "../use-transform"

/**
 * useScroll only measures the scroll every frame while one of its values has
 * a change subscriber. Its scrollInfo handler listens to window scroll events,
 * so their count shows whether it's tracking.
 */
const page = { scrollTop: 0, scrollHeight: 1100, clientHeight: 100 }
const root = document.documentElement

Object.defineProperty(document, "scrollingElement", {
    value: root,
    configurable: true,
})
for (const key of Object.keys(page) as Array<keyof typeof page>) {
    Object.defineProperty(root, key, {
        get: () => page[key],
        configurable: true,
    })
}

let scrollListeners = 0
const { addEventListener, removeEventListener } = window
window.addEventListener = ((type: string, ...args: any[]) => {
    if (type === "scroll") scrollListeners++
    return (addEventListener as any).call(window, type, ...args)
}) as any
window.removeEventListener = ((type: string, ...args: any[]) => {
    if (type === "scroll") scrollListeners--
    return (removeEventListener as any).call(window, type, ...args)
}) as any

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * Waits long enough for time.now() to move on, so reads measure again.
 */
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 20))

async function scrollTo(scrollTop: number) {
    page.scrollTop = scrollTop
    window.dispatchEvent(new Event("scroll"))
    await nextFrame()
    await nextFrame()
}

type ScrollValues = ReturnType<typeof useScroll>

function renderScroll(Child?: (values: ScrollValues) => any) {
    let values!: ScrollValues
    const Component = () => {
        values = useScroll()
        return Child ? <Child {...values} /> : null
    }
    const result = render(<Component />)
    return { ...result, values: () => values }
}

describe("useScroll JS tracking", () => {
    beforeEach(async () => {
        page.scrollTop = 0
        await nextFrame()
        scrollListeners = 0
    })

    test("doesn't track the scroll while nothing subscribes, and reads it on demand", async () => {
        const { values, unmount } = renderScroll()
        await nextFrame()
        expect(scrollListeners).toBe(0)

        page.scrollTop = 500
        expect(values().scrollYProgress.get()).toBe(0.5)
        expect(values().scrollY.get()).toBe(500)

        await nextTick()
        page.scrollTop = 250
        expect(values().scrollYProgress.get()).toBe(0.25)
        expect(scrollListeners).toBe(0)

        unmount()
    })

    test("a subscriber added mid-scroll catches up without being called, then follows the scroll", async () => {
        const { values, unmount } = renderScroll()
        await scrollTo(400)

        const { scrollYProgress } = values()
        const latest: number[] = []
        const unsubscribe = scrollYProgress.on("change", (v) => latest.push(v))
        expect(latest).toEqual([])
        expect(scrollYProgress.get()).toBe(0.4)
        expect(scrollListeners).toBe(1)

        await scrollTo(600)
        expect(latest).toEqual([0.6])

        unsubscribe()
        unmount()
    })

    test("stops tracking a frame after the last subscriber leaves, and keeps reading correctly", async () => {
        const { values, unmount } = renderScroll()
        await nextFrame()
        const { scrollY, scrollYProgress } = values()

        const unsubscribeA = scrollY.on("change", () => {})
        const unsubscribeB = scrollYProgress.on("change", () => {})
        expect(scrollListeners).toBe(1)

        unsubscribeA()
        unsubscribeB()
        // Unsubscribing twice doesn't release twice
        unsubscribeB()
        expect(scrollListeners).toBe(1)

        await nextFrame()
        expect(scrollListeners).toBe(0)

        page.scrollTop = 900
        expect(scrollYProgress.get()).toBe(0.9)

        unmount()
    })

    test("keeps tracking when a subscriber is replaced within a frame", async () => {
        const { values, unmount } = renderScroll()
        await nextFrame()
        const { scrollYProgress } = values()

        scrollYProgress.on("change", () => {})()
        const latest: number[] = []
        const unsubscribe = scrollYProgress.on("change", (v) => latest.push(v))
        await nextFrame()
        expect(scrollListeners).toBe(1)

        await scrollTo(300)
        expect(latest).toEqual([0.3])

        unsubscribe()
        unmount()
    })

    test("tracks for JS consumers mixed with accelerated ones", async () => {
        let x!: MotionValue<number>
        const { unmount } = renderScroll(({ scrollYProgress }) => {
            x = useTransform(scrollYProgress, [0, 1], [0, 100])
            return null
        })
        await nextFrame()
        expect(scrollListeners).toBe(1)

        await scrollTo(700)
        expect(x.get()).toBe(70)

        unmount()
        await nextFrame()
        expect(scrollListeners).toBe(0)
    })

    test("useMotionValueEvent subscribers follow the scroll in StrictMode, and stop on unmount", async () => {
        const latest: number[] = []
        const { unmount } = renderScroll(({ scrollYProgress }) => {
            useMotionValueEvent(scrollYProgress, "change", (v) =>
                latest.push(v)
            )
            return null
        })
        await nextFrame()
        expect(scrollListeners).toBe(1)

        await scrollTo(200)
        expect(latest).toEqual([0.2])

        unmount()
        await nextFrame()
        expect(scrollListeners).toBe(0)
    })

    test("reads the current scroll inside an event handler", async () => {
        let read: number | undefined
        const { container, unmount } = renderScroll(({ scrollYProgress }) => (
            <button onClick={() => (read = scrollYProgress.get())} />
        ))
        await nextFrame()

        page.scrollTop = 800
        await click(container.querySelector("button")!)
        expect(read).toBe(0.8)
        expect(scrollListeners).toBe(0)

        unmount()
    })

    test("keeps tracking once velocity is read", async () => {
        const { values, unmount } = renderScroll()
        await nextFrame()
        const { scrollY } = values()

        expect(scrollY.getVelocity()).toBe(0)
        expect(scrollListeners).toBe(1)

        page.scrollTop = 100
        window.dispatchEvent(new Event("scroll"))
        await nextFrame()
        page.scrollTop = 200
        window.dispatchEvent(new Event("scroll"))
        await nextFrame()
        expect(scrollY.getVelocity()).toBeGreaterThan(0)

        unmount()
        await nextFrame()
        expect(scrollListeners).toBe(0)
    })

    test("velocity is live from the first read while the scroll is tracked", async () => {
        const { values, unmount } = renderScroll(({ scrollY }) => {
            useMotionValueEvent(scrollY, "change", () => {})
            return null
        })
        await nextFrame()
        const { scrollY, scrollYProgress } = values()

        page.scrollTop = 100
        window.dispatchEvent(new Event("scroll"))
        await nextFrame()
        page.scrollTop = 200
        window.dispatchEvent(new Event("scroll"))
        await nextFrame()
        expect(scrollY.getVelocity()).toBeGreaterThan(0)
        expect(scrollYProgress.getVelocity()).toBeGreaterThan(0)

        unmount()
    })

    test("starts tracking once refs resolve for subscribers added before", async () => {
        const latest: number[] = []
        const Component = () => {
            const { scrollYProgress } = useScroll()
            useEffect(
                () => scrollYProgress.on("change", (v) => latest.push(v)),
                []
            )
            return null
        }
        const { unmount } = render(<Component />)
        await nextFrame()
        expect(scrollListeners).toBe(1)

        await act(() => scrollTo(500))
        expect(latest[latest.length - 1]).toBe(0.5)

        unmount()
    })
})
