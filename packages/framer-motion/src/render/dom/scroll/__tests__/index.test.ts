import { frame, frameData, supportsFlags } from "motion-dom"
import { scroll } from "../"
import { ScrollOffset } from "../offsets/presets"
import { scrollInfo } from "../track"
import { ScrollInfo } from "../types"

type Measurements = {
    [key: string]: number
}

const measurements = new Map<Element, Measurements>()

// Mock scrollingElement for testing
Object.defineProperty(document, "scrollingElement", {
    value: document.documentElement,
    writable: false,
    configurable: true,
})

async function nextFrame() {
    return new Promise((resolve) => {
        window.dispatchEvent(new window.Event("scroll"))
        frame.postRender(resolve)
    })
}

const createMockMeasurement = (element: Element | null, name: string) => {
    if (element === null) {
        console.error("scroll element is null")
        return (value: number) => {
            elementMeasurements[name] = value
        }
    }

    const elementMeasurements = measurements.get(element) || {}

    measurements.set(element, elementMeasurements)

    if (!element.hasOwnProperty(name)) {
        Object.defineProperty(element, name, {
            get: () => {
                return elementMeasurements[name] ?? 0
            },
            set: () => {},
        })
    }

    return (value: number) => {
        elementMeasurements[name] = value
    }
}

const setWindowHeight = createMockMeasurement(
    document.scrollingElement,
    "clientHeight"
)
const setDocumentHeight = createMockMeasurement(
    document.scrollingElement,
    "scrollHeight"
)
const setScrollTop = createMockMeasurement(
    document.scrollingElement,
    "scrollTop"
)

async function fireScroll(distance: number = 0) {
    setScrollTop(distance)
    window.dispatchEvent(new window.Event("scroll"))
    return nextFrame()
}

describe("scrollInfo", () => {
    test("Fires onScroll on creation.", async () => {
        const onScroll = jest.fn()

        const stopScroll = scrollInfo(onScroll)

        return new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => {
                expect(onScroll).toBeCalled()

                stopScroll()

                resolve()
            })
        })
    })

    test("Fires onScroll once per frame when resubscribed synchronously, as in StrictMode.", async () => {
        const container = document.createElement("div")
        createMockMeasurement(container, "clientHeight")(100)
        createMockMeasurement(container, "scrollHeight")(1000)

        scrollInfo(() => {}, { container })()

        const timestamps: number[] = []
        const stopScroll = scrollInfo(
            () => {
                timestamps.push(frameData.timestamp)
            },
            { container }
        )

        await nextFrame()
        container.dispatchEvent(new window.Event("scroll"))
        await nextFrame()
        stopScroll()

        expect(timestamps.length).toBeGreaterThan(0)
        expect(new Set(timestamps).size).toBe(timestamps.length)
    })

    test("Fires onScroll on scroll.", async () => {
        let latest: ScrollInfo

        const stopScroll = scrollInfo((info) => {
            latest = info
        })

        setWindowHeight(1000)
        setDocumentHeight(3000)

        return new Promise<void>(async (resolve) => {
            await fireScroll(10)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(10)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(0.005)

            await fireScroll(2000)

            expect(latest.y.current).toEqual(2000)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(1)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on scroll with different container.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )

        setContainerHeight(100)
        setContainerLength(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(100)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.1, 1)

            await fireElementScroll(450)

            expect(latest.y.current).toEqual(450)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toEqual(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on scroll with different container with child target.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")
        const target = document.createElement("div")
        container.appendChild(target)

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )
        const setTargetHeight = createMockMeasurement(target, "clientHeight")
        const setTargetOffsetTop = createMockMeasurement(target, "offsetTop")

        setContainerHeight(100)
        setContainerLength(1000)
        setTargetHeight(200)
        setTargetOffsetTop(100)

        async function fireElementScroll(distance: number = 0) {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { container, target, offset: ScrollOffset.Enter }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(0)
            expect(latest.y.current).toEqual(0)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0, 1)

            await fireElementScroll(100)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on window scroll with child target.", async () => {
        await fireScroll(0)
        let latest: ScrollInfo

        const target = document.createElement("div")
        document.documentElement.appendChild(target)

        const setTargetHeight = createMockMeasurement(target, "clientHeight")
        const setTargetOffsetTop = createMockMeasurement(target, "offsetTop")

        setWindowHeight(100)
        setDocumentHeight(1000)
        setTargetHeight(200)
        setTargetOffsetTop(100)

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { target, offset: ScrollOffset.Enter }
        )

        return new Promise<void>(async (resolve) => {
            await nextFrame()

            expect(latest.y.current).toEqual(0)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0, 1)

            await fireScroll(100)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on resize.", async () => {
        let latest: ScrollInfo

        const stopScroll = scrollInfo((info) => {
            latest = info
        })

        setWindowHeight(1000)
        setDocumentHeight(3000)

        return new Promise<void>(async (resolve) => {
            await fireScroll(500)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(500)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(0.25)
            await nextFrame()

            setWindowHeight(500)
            setDocumentHeight(6000)

            window.dispatchEvent(new window.Event("resize"))
            await nextFrame()
            expect(latest.y.current).toEqual(500)
            expect(latest.y.targetLength).toEqual(6000)
            expect(latest.y.containerLength).toEqual(500)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on element resize.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )

        setContainerHeight(100)
        setContainerLength(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(100)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.1, 1)
            await nextFrame()
            setContainerHeight(500)
            setContainerLength(2000)

            window.dispatchEvent(new window.Event("resize"))
            await nextFrame()
            expect(latest.y.current).toEqual(100)
            expect(latest.y.targetLength).toEqual(2000)
            expect(latest.y.containerLength).toEqual(500)

            stopScroll()

            resolve()
        })
    })

    test("Reports non-negative progress for negative scroll values (reverse directions).", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")
        container.style.display = "flex"
        container.style.flexDirection = "column-reverse"

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )

        setContainerHeight(100)
        setContainerLength(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            // Simulate reverse direction (column-reverse/row-reverse/writing-mode: vertical-rl)
            // where browsers report negative scrollTop/scrollLeft
            await fireElementScroll(-100)

            expect(latest.y.current).toEqual(100)
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.progress).toBeCloseTo(0.1, 1)

            await fireElementScroll(-450)

            expect(latest.y.current).toEqual(450)
            expect(latest.y.progress).toEqual(0.5)

            await fireElementScroll(-900)

            expect(latest.y.current).toEqual(900)
            expect(latest.y.progress).toEqual(1)

            stopScroll()

            resolve()
        })
    })

    test("Reports non-negative progress for negative scrollLeft (x axis, reverse directions).", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")
        container.style.direction = "rtl"

        const setContainerWidth = createMockMeasurement(
            container,
            "clientWidth"
        )
        const setContainerScrollWidth = createMockMeasurement(
            container,
            "scrollWidth"
        )
        const setContainerScrollLeft = createMockMeasurement(
            container,
            "scrollLeft"
        )

        setContainerWidth(100)
        setContainerScrollWidth(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollLeft(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scrollInfo(
            (info) => {
                latest = info
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(-450)

            expect(latest.x.current).toEqual(450)
            expect(latest.x.scrollLength).toEqual(900)
            expect(latest.x.progress).toEqual(0.5)

            stopScroll()

            resolve()
        })
    })

    function createOverscrollContainer(style: Partial<CSSStyleDeclaration>) {
        const container = document.createElement("div")
        Object.assign(container.style, style)
        const setHeight = createMockMeasurement(container, "clientHeight")
        const setScrollHeight = createMockMeasurement(container, "scrollHeight")
        const setTop = createMockMeasurement(container, "scrollTop")
        const setWidth = createMockMeasurement(container, "clientWidth")
        const setScrollWidth = createMockMeasurement(container, "scrollWidth")
        const setScrollLeft = createMockMeasurement(container, "scrollLeft")
        setHeight(100)
        setScrollHeight(1000)
        setWidth(100)
        setScrollWidth(1000)

        let latest: ScrollInfo
        const stop = scrollInfo((info) => (latest = info), { container })

        const fire = async (top: number, left = 0) => {
            setTop(top)
            setScrollLeft(left)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
            return latest
        }

        return { fire, stop }
    }

    test("Reports elastic overscroll at the start of the page as backward scroll (#3791).", async () => {
        await fireScroll(0)
        setWindowHeight(1000)
        setDocumentHeight(3000)

        let latest: ScrollInfo
        const stop = scrollInfo((info) => (latest = info))

        try {
            await fireScroll(100)
            expect(latest!.y.current).toBe(100)

            // Safari rubber-band at the top reports a negative scrollY
            await fireScroll(-25)
            expect(latest!.y.current).toBe(-25)
            expect(latest!.y.progress).toBe(0)
            expect(latest!.y.velocity).toBeLessThan(0)

            // ...and past the bottom, a scrollY beyond the scroll length
            await fireScroll(2025)
            expect(latest!.y.current).toBe(2025)
            expect(latest!.y.progress).toBe(1)
        } finally {
            stop()
            await fireScroll(0)
        }
    })

    test("Reports elastic overscroll in an element container as backward scroll (#3791).", async () => {
        const { fire, stop } = createOverscrollContainer({})

        let info = await fire(-25, -10)
        expect(info.y.current).toBe(-25)
        expect(info.y.progress).toBe(0)
        expect(info.x.current).toBe(-10)
        expect(info.x.progress).toBe(0)

        info = await fire(925, 910)
        expect(info.y.progress).toBe(1)
        expect(info.x.progress).toBe(1)

        stop()
    })

    test("Reports elastic overscroll in reverse-direction containers as backward scroll (#3791).", async () => {
        // column-reverse scrolls from 0 up to -scrollLength, so overscroll
        // at its start is a positive scrollTop
        const column = createOverscrollContainer({
            display: "flex",
            flexDirection: "column-reverse",
        })

        let info = await column.fire(0)
        expect(Object.is(info.y.current, 0)).toBe(true)

        info = await column.fire(-450)
        expect(info.y.current).toBe(450)
        expect(info.y.progress).toBe(0.5)

        info = await column.fire(25)
        expect(info.y.current).toBe(-25)
        expect(info.y.progress).toBe(0)

        info = await column.fire(-925)
        expect(info.y.current).toBe(925)
        expect(info.y.progress).toBe(1)

        column.stop()

        const rtl = createOverscrollContainer({ direction: "rtl" })

        info = await rtl.fire(0, -450)
        expect(info.x.current).toBe(450)
        expect(info.x.progress).toBe(0.5)

        info = await rtl.fire(0, 25)
        expect(info.x.current).toBe(-25)
        expect(info.x.progress).toBe(0)

        rtl.stop()
    })

    test.each([
        // [style, scrollLeft sign, scrollTop sign]
        [{}, 1, 1],
        [{ direction: "rtl" }, -1, 1],
        [{ display: "flex", flexDirection: "row-reverse" }, -1, 1],
        [
            { display: "flex", flexDirection: "row-reverse", direction: "rtl" },
            1,
            1,
        ],
        [{ display: "inline-flex", flexDirection: "column-reverse" }, 1, -1],
        // flex-direction has no effect outside flex containers
        [{ flexDirection: "column-reverse" }, 1, 1],
        [{ writingMode: "vertical-rl" }, -1, 1],
        [{ writingMode: "vertical-lr" }, 1, 1],
        [{ writingMode: "vertical-lr", direction: "rtl" }, 1, -1],
        [{ writingMode: "vertical-rl", direction: "rtl" }, -1, -1],
        [{ writingMode: "sideways-rl" }, -1, 1],
        [{ writingMode: "sideways-lr" }, 1, -1],
        [
            {
                writingMode: "vertical-lr",
                display: "flex",
                flexDirection: "column-reverse",
            },
            -1,
            1,
        ],
        [
            {
                writingMode: "vertical-rl",
                display: "flex",
                flexDirection: "row-reverse",
            },
            -1,
            -1,
        ],
        [
            {
                writingMode: "vertical-rl",
                display: "flex",
                flexDirection: "column-reverse",
            },
            1,
            1,
        ],
        [{ writingMode: "sideways-lr", direction: "rtl" }, 1, 1],
        // wrap-reverse reverses the cross axis
        [{ display: "flex", flexWrap: "wrap-reverse" }, 1, -1],
        [
            {
                display: "flex",
                flexDirection: "column",
                flexWrap: "wrap-reverse",
            },
            -1,
            1,
        ],
        [{ display: "grid" }, 1, 1],
    ] as const)(
        // Signs as measured in Chromium
        "Normalises scroll position for %o",
        async (style, xSign, ySign) => {
            const { fire, stop } = createOverscrollContainer(style as any)

            const info = await fire(450 * ySign, 300 * xSign)
            expect(info.x.current).toBe(300)
            expect(info.y.current).toBe(450)

            stop()
        }
    )
})

describe("scroll", () => {
    test("Fires onScroll on creation.", async () => {
        const onScroll = jest.fn()

        const stopScroll = scroll((_progress, info) => onScroll(info))

        return new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => {
                expect(onScroll).toBeCalled()

                stopScroll()

                resolve()
            })
        })
    })

    test("Fires onScroll on scroll.", async () => {
        let latest: ScrollInfo

        const stopScroll = scroll((_progress, info) => {
            latest = info
        })

        setWindowHeight(1000)
        setDocumentHeight(3000)

        return new Promise<void>(async (resolve) => {
            await fireScroll(10)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(10)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(0.005)

            await fireScroll(2000)

            expect(latest.y.current).toEqual(2000)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(1)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on scroll with different container.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )

        setContainerHeight(100)
        setContainerLength(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scroll(
            (_progress, info) => {
                latest = info
                expect(_progress).toEqual(info.y.progress)
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(100)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.1, 1)

            await fireElementScroll(450)

            expect(latest.y.current).toEqual(450)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toEqual(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on scroll with different container with child target.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")
        const target = document.createElement("div")
        container.appendChild(target)

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )
        const setTargetHeight = createMockMeasurement(target, "clientHeight")
        const setTargetOffsetTop = createMockMeasurement(target, "offsetTop")

        setContainerHeight(100)
        setContainerLength(1000)
        setTargetHeight(200)
        setTargetOffsetTop(100)

        async function fireElementScroll(distance: number = 0) {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scroll(
            (_progress, info) => {
                latest = info
            },
            { container, target, offset: ScrollOffset.Enter }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(0)
            expect(latest.y.current).toEqual(0)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0, 1)

            await fireElementScroll(100)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on window scroll with child target.", async () => {
        await fireScroll(0)
        let latest: ScrollInfo

        const target = document.createElement("div")
        document.documentElement.appendChild(target)

        const setTargetHeight = createMockMeasurement(target, "clientHeight")
        const setTargetOffsetTop = createMockMeasurement(target, "offsetTop")

        setWindowHeight(100)
        setDocumentHeight(1000)
        setTargetHeight(200)
        setTargetOffsetTop(100)

        const stopScroll = scroll(
            (_progress, info) => {
                latest = info
            },
            { target, offset: ScrollOffset.Enter }
        )

        return new Promise<void>(async (resolve) => {
            await nextFrame()

            expect(latest.y.current).toEqual(0)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0, 1)

            await fireScroll(100)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 200])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(100)
            expect(latest.y.targetLength).toEqual(200)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.5)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on resize.", async () => {
        let latest: ScrollInfo

        const stopScroll = scroll((_progress, info) => {
            latest = info
        })

        setWindowHeight(1000)
        setDocumentHeight(3000)

        return new Promise<void>(async (resolve) => {
            await fireScroll(500)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(500)
            expect(latest.y.offset).toEqual([0, 2000])
            expect(latest.y.scrollLength).toEqual(2000)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(3000)
            expect(latest.y.containerLength).toEqual(1000)
            expect(latest.y.progress).toEqual(0.25)
            await nextFrame()

            setWindowHeight(500)
            setDocumentHeight(6000)

            window.dispatchEvent(new window.Event("resize"))
            await nextFrame()
            expect(latest.y.current).toEqual(500)
            expect(latest.y.targetLength).toEqual(6000)
            expect(latest.y.containerLength).toEqual(500)

            stopScroll()

            resolve()
        })
    })

    test("Fires onScroll on element resize.", async () => {
        let latest: ScrollInfo

        const container = document.createElement("div")

        const setContainerHeight = createMockMeasurement(
            container,
            "clientHeight"
        )
        const setContainerLength = createMockMeasurement(
            container,
            "scrollHeight"
        )
        const setContainerScrollTop = createMockMeasurement(
            container,
            "scrollTop"
        )

        setContainerHeight(100)
        setContainerLength(1000)

        const fireElementScroll = async (distance: number = 0) => {
            setContainerScrollTop(distance)
            container.dispatchEvent(new window.Event("scroll"))
            await nextFrame()
        }

        const stopScroll = scroll(
            (_progress, info) => {
                latest = info
            },
            { container }
        )

        return new Promise<void>(async (resolve) => {
            await fireElementScroll(100)

            expect(latest.time).not.toEqual(0)
            expect(latest.y.current).toEqual(100)
            expect(latest.y.offset).toEqual([0, 900])
            expect(latest.y.scrollLength).toEqual(900)
            expect(latest.y.targetOffset).toEqual(0)
            expect(latest.y.targetLength).toEqual(1000)
            expect(latest.y.containerLength).toEqual(100)
            expect(latest.y.progress).toBeCloseTo(0.1, 1)
            await nextFrame()
            setContainerHeight(500)
            setContainerLength(2000)

            window.dispatchEvent(new window.Event("resize"))
            await nextFrame()
            expect(latest.y.current).toEqual(100)
            expect(latest.y.targetLength).toEqual(2000)
            expect(latest.y.containerLength).toEqual(500)

            stopScroll()

            resolve()
        })
    })
})

/**
 * Models a native ScrollTimeline: progress is the scroll position over the
 * scrollable length, and the timeline is inactive without scrollable overflow.
 */
class FakeScrollTimeline {
    static instances = 0

    source: Element
    axis: "x" | "y"

    constructor({ source, axis }: { source: Element; axis: "x" | "y" }) {
        FakeScrollTimeline.instances++
        this.source = source
        this.axis = axis
    }

    get currentTime() {
        const el = this.source as any
        const length = this.axis === "x" ? "Width" : "Height"
        const position = this.axis === "x" ? "Left" : "Top"
        const max = el[`scroll${length}`] - el[`client${length}`]
        return max > 0
            ? { value: (Math.abs(el[`scroll${position}`]) / max) * 100 }
            : null
    }
}

describe.each([
    ["with native ScrollTimeline", true],
    ["without native ScrollTimeline", false],
])("scroll() progress callbacks, %s", (_, hasScrollTimeline) => {
    const originalScrollTimeline = (window as any).ScrollTimeline

    beforeEach(() => {
        FakeScrollTimeline.instances = 0
        if (hasScrollTimeline) {
            ;(window as any).ScrollTimeline = FakeScrollTimeline
            supportsFlags.scrollTimeline = true
        } else {
            supportsFlags.scrollTimeline = false
        }
    })

    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        if (originalScrollTimeline === undefined) {
            delete (window as any).ScrollTimeline
        } else {
            ;(window as any).ScrollTimeline = originalScrollTimeline
        }
    })

    /**
     * Registers a progress-only callback alongside a (progress, info)
     * callback, which has always used scrollInfo, and returns both readings.
     */
    function trackProgress(options: Parameters<typeof scroll>[1] = {}) {
        const latest = { progress: -1, infoProgress: -1 }
        const axis = options.axis ?? "y"
        const stopProgress = scroll((p: number) => {
            latest.progress = p
        }, options)
        const stopInfo = scroll((_p, info) => {
            latest.infoProgress = info[axis].progress
        }, options)

        return {
            latest,
            stop: () => {
                stopProgress()
                stopInfo()
            },
        }
    }

    function createContainer() {
        const container = document.createElement("div")
        return {
            container,
            setHeight: createMockMeasurement(container, "clientHeight"),
            setScrollHeight: createMockMeasurement(container, "scrollHeight"),
            setScrollTop: createMockMeasurement(container, "scrollTop"),
            setWidth: createMockMeasurement(container, "clientWidth"),
            setScrollWidth: createMockMeasurement(container, "scrollWidth"),
            setScrollLeft: createMockMeasurement(container, "scrollLeft"),
            fire: async () => {
                container.dispatchEvent(new window.Event("scroll"))
                await nextFrame()
            },
        }
    }

    test("Page scroll.", async () => {
        await fireScroll(0)
        setWindowHeight(1000)
        setDocumentHeight(3000)

        const { latest, stop } = trackProgress()

        for (const [scrollTop, expected] of [
            [0, 0],
            [500, 0.25],
            [1234, 0.617],
            [2000, 1],
        ]) {
            await fireScroll(scrollTop)
            expect(latest.progress).toBeCloseTo(expected, 5)
            expect(latest.progress).toBe(latest.infoProgress)
        }

        stop()
    })

    test("Element container.", async () => {
        const c = createContainer()
        c.setHeight(100)
        c.setScrollHeight(1000)

        const { latest, stop } = trackProgress({ container: c.container })

        for (const [scrollTop, expected] of [
            [0, 0],
            [450, 0.5],
            [900, 1],
        ]) {
            c.setScrollTop(scrollTop)
            await c.fire()
            expect(latest.progress).toBeCloseTo(expected, 5)
            expect(latest.progress).toBe(latest.infoProgress)
        }

        stop()
    })

    test("Element container passed as the legacy source option.", async () => {
        const c = createContainer()
        c.setHeight(200)
        c.setScrollHeight(1000)

        const { latest, stop } = trackProgress({ source: c.container as any })

        c.setScrollTop(400)
        await c.fire()
        expect(latest.progress).toBeCloseTo(0.5, 5)
        expect(latest.progress).toBe(latest.infoProgress)

        stop()
    })

    test("Element container, x axis.", async () => {
        const c = createContainer()
        c.setWidth(100)
        c.setScrollWidth(500)

        const { latest, stop } = trackProgress({
            container: c.container,
            axis: "x",
        })

        c.setScrollLeft(100)
        await c.fire()
        expect(latest.progress).toBeCloseTo(0.25, 5)
        expect(latest.progress).toBe(latest.infoProgress)

        stop()
    })

    test("Element container, x axis, RTL.", async () => {
        const c = createContainer()
        c.container.style.direction = "rtl"
        c.setWidth(100)
        c.setScrollWidth(500)

        const { latest, stop } = trackProgress({
            container: c.container,
            axis: "x",
        })

        // RTL containers report negative scrollLeft
        c.setScrollLeft(-300)
        await c.fire()
        expect(latest.progress).toBeCloseTo(0.75, 5)
        expect(latest.progress).toBe(latest.infoProgress)

        stop()
    })

    test("Page scroll with offset (#3668).", async () => {
        await fireScroll(0)
        setWindowHeight(1000)
        setDocumentHeight(3000)

        const { latest, stop } = trackProgress({ offset: [0.5, 1] })

        // Raw progress 0.3 is before the offset starts at 0.5
        await fireScroll(600)
        expect(latest.progress).toBeCloseTo(0)
        expect(latest.progress).toBe(latest.infoProgress)

        // Raw progress 0.75 → (0.75 - 0.5) / (1 - 0.5)
        await fireScroll(1500)
        expect(latest.progress).toBeCloseTo(0.5)
        expect(latest.progress).toBe(latest.infoProgress)

        stop()
    })

    test("Target in an element container.", async () => {
        const c = createContainer()
        const target = document.createElement("div")
        c.container.appendChild(target)
        c.setHeight(100)
        c.setScrollHeight(1000)
        createMockMeasurement(target, "clientHeight")(200)
        createMockMeasurement(target, "offsetTop")(100)

        const { latest, stop } = trackProgress({
            container: c.container,
            target,
            offset: ScrollOffset.Enter,
        })

        for (const [scrollTop, expected] of [
            [0, 0],
            [100, 0.5],
            [150, 0.75],
            [200, 1],
        ]) {
            c.setScrollTop(scrollTop)
            await c.fire()
            expect(latest.progress).toBeCloseTo(expected, 5)
            expect(latest.progress).toBe(latest.infoProgress)
        }

        stop()
    })

    test("Target in the page.", async () => {
        await fireScroll(0)
        const target = document.createElement("div")
        document.documentElement.appendChild(target)
        setWindowHeight(100)
        setDocumentHeight(1000)
        createMockMeasurement(target, "clientHeight")(200)
        createMockMeasurement(target, "offsetTop")(100)

        const { latest, stop } = trackProgress({
            target,
            offset: ScrollOffset.Enter,
        })

        for (const [scrollTop, expected] of [
            [0, 0],
            [100, 0.5],
            [200, 1],
        ]) {
            await fireScroll(scrollTop)
            expect(latest.progress).toBeCloseTo(expected, 5)
            expect(latest.progress).toBe(latest.infoProgress)
        }

        stop()
        target.remove()
    })

    test("Fires once per frame when resubscribed synchronously, as in StrictMode.", async () => {
        const c = createContainer()
        c.setHeight(100)
        c.setScrollHeight(1000)

        scroll((_p: number) => {}, { container: c.container })()

        const timestamps: number[] = []
        const stop = scroll(
            (_p: number) => {
                timestamps.push(frameData.timestamp)
            },
            { container: c.container }
        )

        await nextFrame()
        c.setScrollTop(450)
        await c.fire()
        stop()

        expect(timestamps.length).toBeGreaterThan(0)
        expect(new Set(timestamps).size).toBe(timestamps.length)
    })

    test("Doesn't create a native ScrollTimeline.", async () => {
        const { container } = createContainer()
        const stop = scroll((_p: number) => {}, { container })
        await nextFrame()
        stop()

        expect(FakeScrollTimeline.instances).toBe(0)
    })
})

describe("scroll() ViewTimeline ranges", () => {
    /**
     * A ViewTimeline's currentTime is always its cover progress. For the
     * 200px target at 100px in a 100px scrollport, cover runs from scroll 0
     * (target start meets scrollport end) to 300 (target end leaves start).
     * It's fixed here, so JS-driven values that follow the scroll position
     * can't be reading it.
     */
    const coverProgress = 50
    class FakeViewTimeline {
        currentTime = { value: coverProgress }
    }

    const fakeWaapi = (direction: string) => {
        const waapi: any = {
            plays: 0,
            play: () => waapi.plays++,
            effect: {
                getTiming: () => ({ direction }),
                updateTiming: (timing: any) => Object.assign(waapi, timing),
            },
        }
        return waapi
    }

    /**
     * Attaches a group with one WAAPI animation and one JS-driven value.
     */
    const attach = (offset: any, direction = "normal") => {
        const target = document.createElement("div")
        document.body.appendChild(target)
        createMockMeasurement(target, "clientHeight")(200)
        createMockMeasurement(target, "offsetTop")(100)

        const waapi = fakeWaapi(direction)
        const valueAnimation = { time: 0, iterationDuration: 1, pause() {} }
        const stop = scroll(
            {
                attachTimeline: ({ timeline, onAttach, observe }: any) => {
                    timeline && onAttach?.(waapi)
                    return observe(valueAnimation)
                },
            } as any,
            { target, offset }
        )
        return { waapi, valueAnimation, stop }
    }

    beforeEach(async () => {
        ;(window as any).ViewTimeline = FakeViewTimeline
        supportsFlags.viewTimeline = true
        await fireScroll(0)
        setWindowHeight(100)
        setDocumentHeight(1000)
    })

    afterEach(() => {
        supportsFlags.viewTimeline = undefined
        delete (window as any).ViewTimeline
    })

    test("Sets ranges on WAAPI animations, and tracks JS-driven values on other ranges in JS", async () => {
        const { waapi, valueAnimation, stop } = attach(ScrollOffset.Enter)

        // Scroll 50 is 0.25 of Enter's [0, 200]
        await fireScroll(50)
        await nextFrame()

        expect(waapi).toMatchObject({
            rangeStart: "entry-crossing 0%",
            rangeEnd: "entry-crossing 100%",
            direction: "normal",
        })
        expect(valueAnimation.time).toBeCloseTo(0.25)

        stop()
    })

    test("Tracks reversed and size-dependent offsets in JS", async () => {
        // Scroll 75 is 0.75 of Any's [300, 0], and 0 of All's [100, 200]
        const any = attach(ScrollOffset.Any)
        const all = attach(ScrollOffset.All)
        await fireScroll(75)
        await nextFrame()
        expect(any.valueAnimation.time).toBeCloseTo(0.75)
        expect(all.valueAnimation.time).toBeCloseTo(0)

        any.stop()
        all.stop()
    })

    test("Only creates native timelines for WAAPI animations", () => {
        let created = 0
        const count = (Timeline: any) =>
            class extends Timeline {
                constructor() {
                    super()
                    created++
                }
            }
        ;(window as any).ViewTimeline = count(FakeViewTimeline)
        ;(window as any).ScrollTimeline = count(class {})
        supportsFlags.scrollTimeline = true

        const target = document.createElement("div")
        for (const options of [
            { target, offset: ScrollOffset.Enter },
            { target, offset: ["start end", "end start"] },
            {},
        ]) {
            const valueAnimation = { time: 0, iterationDuration: 1, pause() {} }
            const stop = scroll(
                {
                    attachTimeline: ({ observe }: any) =>
                        observe(valueAnimation),
                } as any,
                options as any
            )
            stop()
        }
        expect(created).toBe(0)

        supportsFlags.scrollTimeline = undefined
        delete (window as any).ScrollTimeline
    })

    test("Plays Any backwards over the cover range", () => {
        const { waapi, stop } = attach(ScrollOffset.Any)
        expect(waapi).toMatchObject({
            rangeStart: "entry-crossing 0%",
            rangeEnd: "exit-crossing 100%",
            direction: "reverse",
        })
        stop()

        const alternate = attach(ScrollOffset.Any, "alternate")
        expect(alternate.waapi.direction).toBe("alternate-reverse")
        alternate.stop()
    })

    test("Flips All when the target becomes shorter than the container", () => {
        // Target 200px, container 100px
        const { waapi, stop } = attach(undefined)
        expect(waapi).toMatchObject({
            rangeStart: "exit-crossing 0%",
            rangeEnd: "entry-crossing 100%",
            direction: "normal",
        })

        const plays = waapi.plays
        setWindowHeight(400)
        window.dispatchEvent(new window.Event("resize"))
        expect(waapi).toMatchObject({
            rangeStart: "entry-crossing 100%",
            rangeEnd: "exit-crossing 0%",
            direction: "reverse",
        })

        // Replayed, so a flip before the first frame realigns with the new range
        expect(waapi.plays).toBe(plays + 1)

        // Resizes that don't flip the direction leave the animation alone
        setWindowHeight(300)
        window.dispatchEvent(new window.Event("resize"))
        expect(waapi.plays).toBe(plays + 1)

        // Equal lengths collapse the range to a point, where JS steps forwards
        setWindowHeight(200)
        window.dispatchEvent(new window.Event("resize"))
        expect(waapi.direction).toBe("normal")

        stop()
        setWindowHeight(400)
        window.dispatchEvent(new window.Event("resize"))
        expect(waapi.direction).toBe("normal")
    })

    test("Tracks JS-driven values on the cover range in JS", async () => {
        const { waapi, valueAnimation, stop } = attach([
            "start end",
            "end start",
        ])

        // Scroll 50 is 1/6 of cover's [0, 300], while the ViewTimeline says 0.5
        await fireScroll(50)
        await nextFrame()
        expect(valueAnimation.time).toBeCloseTo(1 / 6)
        expect(waapi).toMatchObject({
            rangeStart: "entry-crossing 0%",
            rangeEnd: "exit-crossing 100%",
            direction: "normal",
        })

        stop()
    })

    test("Shares one scrollInfo measurement between an animation's JS-driven values, and stops each on its own", async () => {
        const target = document.createElement("div")
        document.body.appendChild(target)
        createMockMeasurement(target, "clientHeight")(200)
        createMockMeasurement(target, "offsetTop")(100)

        const values = [0, 1].map(() => ({
            time: 0,
            iterationDuration: 1,
            pause() {},
        }))
        const stops: VoidFunction[] = []
        const stop = scroll(
            {
                attachTimeline: ({
                    observe,
                }: {
                    observe: (value: object) => VoidFunction
                }) => {
                    stops.push(...values.map((value) => observe(value)))
                    return () => stops.forEach((stopValue) => stopValue())
                },
            } as any,
            { target, offset: ScrollOffset.Enter }
        )

        await fireScroll(50)
        await nextFrame()
        expect(values.map(({ time }) => time)).toEqual([0.25, 0.25])

        stops[1]()
        await fireScroll(100)
        await nextFrame()
        expect(values.map(({ time }) => time)).toEqual([0.5, 0.25])

        stop()
        await fireScroll(150)
        await nextFrame()
        expect(values[0].time).toBe(0.5)
    })
})
