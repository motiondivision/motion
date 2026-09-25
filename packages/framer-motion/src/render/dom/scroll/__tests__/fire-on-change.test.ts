import { frame } from "motion-dom"
import { scroll } from "../"
import { scrollInfo } from "../track"
import { ScrollInfo, ScrollOffset } from "../types"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

/**
 * A handler added to a container that already has a scroll listener is
 * first measured on the frame after next.
 */
async function subscribedFrame() {
    await nextFrame()
    await nextFrame()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function mockMeasurements<T extends Record<string, number | Element>>(
    element: Element,
    values: T
) {
    for (const name in values) {
        Object.defineProperty(element, name, {
            configurable: true,
            get: () => values[name],
        })
    }
    return values
}

/**
 * A 500 × 500 container with a scroll length of 2500 on both axes, holding
 * a 100 × 100 target at (1500, 1500). With ["start end", "end start"] the
 * target's offsets resolve to [1000, 1600] on each axis.
 */
function setup() {
    const container = document.createElement("div")
    container.style.position = "relative"
    document.body.appendChild(container)
    const containerSize = mockMeasurements(container, {
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 3000,
        scrollWidth: 3000,
        clientHeight: 500,
        clientWidth: 500,
    })

    const target = document.createElement("div")
    container.appendChild(target)
    const targetSize = mockMeasurements(target, {
        offsetTop: 1500,
        offsetLeft: 1500,
        offsetParent: container,
        clientHeight: 100,
        clientWidth: 100,
    })

    const scrollTo = async (top: number, left = containerSize.scrollLeft) => {
        containerSize.scrollTop = top
        containerSize.scrollLeft = left
        container.dispatchEvent(new window.Event("scroll"))
        await nextFrame()
    }

    const resize = async () => {
        window.dispatchEvent(new window.Event("resize"))
        await nextFrame()
    }

    const trackTarget = {
        container,
        target,
        offset: ["start end", "end start"] as ScrollOffset,
    }

    return {
        container,
        containerSize,
        targetSize,
        scrollTo,
        resize,
        trackTarget,
    }
}

describe("scroll(onProgress) with element tracking only fires on change", () => {
    test("Fires on the first frame, then only when progress changes", async () => {
        const { scrollTo, trackTarget } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), trackTarget)

        await nextFrame()
        expect(calls).toEqual([0])

        await scrollTo(100)
        await scrollTo(500)
        await scrollTo(900)
        expect(calls).toEqual([0])

        await scrollTo(1300)
        expect(calls).toEqual([0, 0.5])

        // A scroll event without movement
        await scrollTo(1300)
        expect(calls).toEqual([0, 0.5])

        // Jumping past the end in one frame still delivers the clamped 1
        await scrollTo(2000)
        await scrollTo(2400)
        expect(calls).toEqual([0, 0.5, 1])

        // Reversed scroll
        await scrollTo(1150)
        await scrollTo(0)
        await scrollTo(50)
        expect(calls).toEqual([0, 0.5, 1, 0.25, 0])

        stop()
    })

    test("Offset-only one-argument callbacks also skip unchanged frames", async () => {
        const { container, containerSize, scrollTo } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), {
            container,
            offset: [0.5, 1],
        })

        await nextFrame()
        await scrollTo(250)
        await scrollTo(1000)
        expect(calls).toEqual([0])

        await scrollTo(1875)
        expect(calls).toEqual([0, 0.5])
        expect(containerSize.scrollTop).toBe(1875)

        stop()
    })

    test("Still receives info as the second argument when it fires", async () => {
        const { scrollTo, trackTarget } = setup()
        const current: number[] = []

        // Rest parameters give the function a length of 0
        const onScroll = (...args: [number, ScrollInfo]) =>
            current.push(args[1].y.current)
        const stop = scroll(
            onScroll as unknown as (p: number) => void,
            trackTarget
        )

        await nextFrame()
        await scrollTo(1300)
        expect(current).toEqual([0, 1300])

        stop()
    })

    test("A resize that changes progress notifies without a scroll", async () => {
        const { containerSize, scrollTo, resize, trackTarget } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), trackTarget)

        await nextFrame()
        await scrollTo(1300)
        expect(calls).toEqual([0, 0.5])

        // Offsets become [800, 1600], so progress is 500 / 800
        containerSize.clientHeight = 700
        await resize()
        expect(calls).toEqual([0, 0.5, 0.625])

        stop()
    })

    test("A resize that leaves progress unchanged doesn't notify", async () => {
        const { targetSize, resize, trackTarget } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), trackTarget)

        await nextFrame()
        targetSize.clientHeight = 300
        await resize()
        expect(calls).toEqual([0])

        stop()
    })

    test("Only the tracked axis triggers a notification", async () => {
        const { scrollTo, trackTarget } = setup()
        const x: number[] = []
        const y: number[] = []

        const stopX = scroll((p: number) => x.push(p), {
            ...trackTarget,
            axis: "x",
        })
        const stopY = scroll((p: number) => y.push(p), trackTarget)

        await nextFrame()
        await scrollTo(1300, 0)
        expect(x).toEqual([0])
        expect(y).toEqual([0, 0.5])

        await scrollTo(1300, 1450)
        expect(x).toEqual([0, 0.75])
        expect(y).toEqual([0, 0.5])

        stopX()
        stopY()
    })

    test("Subscribing mid-scroll fires the new handler without re-firing unchanged ones", async () => {
        const { scrollTo, trackTarget } = setup()
        const first: number[] = []
        const withInfo: number[] = []
        const second: number[] = []

        const stopFirst = scroll((p: number) => first.push(p), trackTarget)
        const stopWithInfo = scroll(
            (_p, info) => withInfo.push(info.y.current),
            trackTarget
        )

        await nextFrame()
        await scrollTo(1300)
        expect(first).toEqual([0, 0.5])
        expect(withInfo).toEqual([0, 1300])

        const stopSecond = scroll((p: number) => second.push(p), trackTarget)
        await subscribedFrame()

        expect(second).toEqual([0.5])
        expect(first).toEqual([0, 0.5])
        // Handlers that receive info are notified on every measured frame
        expect(withInfo).toEqual([0, 1300, 1300])

        stopFirst()
        stopWithInfo()
        stopSecond()
    })

    test("Unsubscribing mid-scroll stops notifications, and resubscribing fires again", async () => {
        const { scrollTo, trackTarget } = setup()
        const calls: number[] = []
        const other: number[] = []

        const stopOther = scroll((p: number) => other.push(p), trackTarget)
        let stop = scroll((p: number) => calls.push(p), trackTarget)

        await nextFrame()
        await scrollTo(1300)
        stop()

        await scrollTo(1450)
        expect(calls).toEqual([0, 0.5])
        expect(other).toEqual([0, 0.5, 0.75])

        stop = scroll((p: number) => calls.push(p), trackTarget)
        await subscribedFrame()
        expect(calls).toEqual([0, 0.5, 0.75])

        stop()
        stopOther()
    })

    test("A handler unsubscribing itself mid-notify doesn't affect its siblings", async () => {
        const { scrollTo, trackTarget } = setup()
        const calls: number[] = []
        const sibling: number[] = []

        const stop: VoidFunction = scroll((p: number) => {
            calls.push(p)
            if (p > 0) stop()
        }, trackTarget)
        const stopSibling = scroll((p: number) => sibling.push(p), trackTarget)

        await nextFrame()
        await scrollTo(1300)
        await scrollTo(1450)

        expect(calls).toEqual([0, 0.5])
        expect(sibling).toEqual([0, 0.5, 0.75])

        stopSibling()
    })

    test("Rapid start/stop delivers every distinct progress and ends on the final one", async () => {
        const { container, containerSize, scrollTo, trackTarget } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), trackTarget)
        await nextFrame()

        // Several scroll events within one frame are measured once
        for (const top of [1100, 1200, 1300]) {
            containerSize.scrollTop = top
            container.dispatchEvent(new window.Event("scroll"))
        }
        await nextFrame()
        expect(calls).toEqual([0, 0.5])

        // Stop, then start again from the same position
        await wait(60)
        await scrollTo(1300)
        await scrollTo(1360)
        await scrollTo(1300)
        expect(calls).toEqual([0, 0.5, 0.6, 0.5])

        stop()
    })
})

describe("Consumers that receive info fire on every measured frame", () => {
    test("(progress, info) callbacks fire while progress is unchanged", async () => {
        const { scrollTo, trackTarget } = setup()
        const infos: Array<[number, number]> = []

        const stop = scroll(
            (p, info) => infos.push([p, info.y.current]),
            trackTarget
        )

        await nextFrame()
        await scrollTo(100)
        await scrollTo(200)

        expect(infos).toEqual([
            [0, 0],
            [0, 100],
            [0, 200],
        ])

        stop()
    })

    test("Callbacks declaring more than two parameters fire while progress is unchanged", async () => {
        const { scrollTo, trackTarget } = setup()
        const current: number[] = []

        const onScroll = (_p: number, info: ScrollInfo, _extra?: unknown) =>
            current.push(info.y.current)
        const stop = scroll(
            onScroll as (p: number, info: ScrollInfo) => void,
            trackTarget
        )

        await nextFrame()
        await scrollTo(100)
        expect(current).toEqual([0, 100])

        stop()
    })

    test("scrollInfo fires while progress is unchanged", async () => {
        const { scrollTo, trackTarget } = setup()
        const current: number[] = []

        const stop = scrollInfo(
            (info) => current.push(info.y.current),
            trackTarget
        )

        await nextFrame()
        await scrollTo(100)
        await scrollTo(200)
        expect(current).toEqual([0, 100, 200])

        stop()
    })

    test("Velocity settles to 0 on a frame where progress doesn't change", async () => {
        const { scrollTo, resize, trackTarget } = setup()
        const withInfo: Array<[number, number]> = []
        const info: number[] = []
        const progressOnly: number[] = []

        const stops = [
            scroll(
                (p: number, i: ScrollInfo) => withInfo.push([p, i.y.velocity]),
                trackTarget
            ),
            scrollInfo((i) => info.push(i.y.velocity), trackTarget),
            scroll((p: number) => progressOnly.push(p), trackTarget),
        ]

        await nextFrame()
        await scrollTo(100)
        await scrollTo(200)

        const moving = withInfo[withInfo.length - 1]
        expect(moving[0]).toBe(0)
        expect(moving[1]).toBeGreaterThan(0)
        expect(info[info.length - 1]).toBeGreaterThan(0)

        await wait(60)
        await resize()

        expect(withInfo[withInfo.length - 1]).toEqual([0, 0])
        expect(info[info.length - 1]).toBe(0)
        expect(progressOnly).toEqual([0])

        stops.forEach((stop) => stop())
    })

    test("A resize that only changes target size still notifies info consumers", async () => {
        const { targetSize, resize, trackTarget } = setup()
        const lengths: Array<[number, number]> = []

        const stop = scroll(
            (p, info) => lengths.push([p, info.y.targetLength]),
            trackTarget
        )

        await nextFrame()
        targetSize.clientHeight = 300
        await resize()

        expect(lengths).toEqual([
            [0, 100],
            [0, 300],
        ])

        stop()
    })

    test("A container resize without scroll notifies info consumers", async () => {
        const { container, containerSize, resize } = setup()
        const lengths: number[] = []

        const stop = scroll((_p, info) => lengths.push(info.y.scrollLength), {
            container,
        })

        await nextFrame()
        containerSize.scrollHeight = 4000
        await resize()

        expect(lengths).toEqual([2500, 3500])

        stop()
    })

    test("(progress, info) callbacks are notified of changes on the other axis", async () => {
        const { scrollTo, trackTarget } = setup()
        const x: number[] = []

        const stop = scroll((_p, info) => x.push(info.x.current), trackTarget)

        await nextFrame()
        await scrollTo(0, 300)
        expect(x).toEqual([0, 300])

        stop()
    })
})

describe("Page and container progress callbacks", () => {
    test("A resize that leaves progress unchanged doesn't notify", async () => {
        const { container, containerSize, scrollTo, resize } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), { container })

        await nextFrame()
        await scrollTo(1250)
        expect(calls).toEqual([0, 0.5])

        // Scroll length stays 2500
        containerSize.scrollHeight = 3500
        containerSize.clientHeight = 1000
        await resize()
        expect(calls).toEqual([0, 0.5])

        // Scroll length becomes 3000
        containerSize.clientHeight = 500
        await resize()
        expect(calls).toEqual([0, 0.5, 1250 / 3000])

        stop()
    })

    test("One-argument callbacks without a target fire only on change", async () => {
        const { container, scrollTo } = setup()
        const calls: number[] = []

        const stop = scroll((p: number) => calls.push(p), { container })

        await nextFrame()
        await nextFrame()
        await scrollTo(0, 300)
        await scrollTo(1250)
        await nextFrame()
        expect(calls).toEqual([0, 0.5])

        stop()
    })
})
