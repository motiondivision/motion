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
