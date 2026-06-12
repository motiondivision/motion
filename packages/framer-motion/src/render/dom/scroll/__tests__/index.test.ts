import { frame, supportsFlags } from "motion-dom"
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

/**
 * Advance the frame loop without dispatching a `scroll` event. This emulates a
 * frame painted during native smooth scrolling where the compositor has moved
 * the scroll position but the matching `scroll` event hasn't been delivered to
 * JS yet.
 */
async function nextFrameWithoutScrollEvent() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
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

    test("Keeps scroll progress in sync on the frame loop without a scroll event (#2716).", async () => {
        let latest: ScrollInfo

        const stopScroll = scrollInfo((info) => {
            latest = info
        })

        setWindowHeight(1000)
        setDocumentHeight(3000)

        // Establish a baseline via a regular scroll event.
        await fireScroll(0)
        expect(latest!.y.current).toEqual(0)

        // Let the frame loop settle so any pending measure has run.
        await nextFrameWithoutScrollEvent()
        await nextFrameWithoutScrollEvent()

        // Native smooth scrolling (e.g. mouse wheel) advances the scroll
        // position on the compositor, but the matching `scroll` event can be
        // coalesced or delivered a frame late. Motion must still pick up the new
        // position on the frame loop, otherwise the frame renders with a stale
        // progress — the jumpy scrolling reported in #2716.
        setScrollTop(500)
        await nextFrameWithoutScrollEvent()

        expect(latest!.y.current).toEqual(500)
        expect(latest!.y.progress).toEqual(0.25)

        stopScroll()
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

    test("Respects offset when callback has no info parameter (#3668).", async () => {
        // JSDOM lacks window.ScrollTimeline; fake it so the native code path
        // is taken — that's the path that previously dropped offsets.
        class FakeScrollTimeline {
            currentTime: { value: number } | null = { value: 30 }
        }
        const originalScrollTimeline = (window as any).ScrollTimeline
        ;(window as any).ScrollTimeline = FakeScrollTimeline
        supportsFlags.scrollTimeline = true

        try {
            await fireScroll(0)
            setWindowHeight(1000)
            setDocumentHeight(3000)

            let receivedProgress: number | undefined

            const stopScroll = scroll(
                (progress: number) => {
                    receivedProgress = progress
                },
                { offset: [0.5, 1] }
            )

            // scrollLength = 2000. raw progress 600/2000 = 0.3, before offset
            // start of 0.5 → clamped to 0. Without the fix, callback would
            // receive FakeScrollTimeline.currentTime.value / 100 = 0.3.
            await fireScroll(600)
            expect(receivedProgress).toBeCloseTo(0)

            // raw 1500/2000 = 0.75 → (0.75 - 0.5) / (1 - 0.5) = 0.5
            await fireScroll(1500)
            expect(receivedProgress).toBeCloseTo(0.5)

            stopScroll()
        } finally {
            supportsFlags.scrollTimeline = undefined
            if (originalScrollTimeline === undefined) {
                delete (window as any).ScrollTimeline
            } else {
                ;(window as any).ScrollTimeline = originalScrollTimeline
            }
        }
    })
})
