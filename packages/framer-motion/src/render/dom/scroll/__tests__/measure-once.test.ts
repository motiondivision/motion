import { frame } from "motion-dom"
import { scrollInfo } from "../track"
import { ScrollInfo } from "../types"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

type Reads = Record<string, number>

function mockMeasurements(
    element: HTMLElement,
    values: Record<string, number | Element>
) {
    const reads: Reads = {}
    for (const [name, value] of Object.entries(values)) {
        reads[name] = 0
        Object.defineProperty(element, name, {
            configurable: true,
            get: () => {
                reads[name]++
                return value
            },
        })
    }
    return reads
}

const resetReads = (...allReads: Reads[]) => {
    for (const reads of allReads) {
        for (const name in reads) reads[name] = 0
    }
}

function createContainer(scrollTop = 100) {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const reads = mockMeasurements(container, {
        scrollTop,
        scrollLeft: 0,
        scrollHeight: 2000,
        scrollWidth: 500,
        clientHeight: 500,
        clientWidth: 500,
    })
    return { container, reads }
}

function createTarget(container: HTMLElement, offsetTop: number) {
    const target = document.createElement("div")
    container.appendChild(target)
    const reads = mockMeasurements(target, {
        offsetTop,
        offsetLeft: 0,
        offsetParent: container,
        clientHeight: 100,
        clientWidth: 500,
    })
    return { target, reads }
}

async function scrollContainer(container: HTMLElement) {
    container.dispatchEvent(new window.Event("scroll"))
    await nextFrame()
}

describe("scrollInfo measures each container once per frame", () => {
    test("Container metrics are read once, regardless of handler count", async () => {
        const { container, reads } = createContainer()
        const stops: VoidFunction[] = []
        const infos: ScrollInfo[] = []

        for (let i = 0; i < 5; i++) {
            stops.push(
                scrollInfo((info) => infos.push(info), { container })
            )
        }

        await nextFrame()
        resetReads(reads)
        infos.length = 0

        await scrollContainer(container)

        expect(reads).toEqual({
            scrollTop: 1,
            scrollLeft: 1,
            scrollHeight: 1,
            scrollWidth: 1,
            clientHeight: 1,
            clientWidth: 1,
        })

        expect(infos).toHaveLength(5)
        for (const info of infos) {
            expect(info.y.current).toBe(100)
            expect(info.y.scrollLength).toBe(1500)
            expect(info.y.progress).toBeCloseTo(100 / 1500)
        }

        stops.forEach((stop) => stop())
    })

    test("Each target is measured once per frame, container metrics once in total", async () => {
        const { container, reads } = createContainer(400)
        const a = createTarget(container, 600)
        const b = createTarget(container, 1200)
        const progress: Record<string, number> = {}

        const stopA = scrollInfo((info) => (progress.a = info.y.progress), {
            container,
            target: a.target,
            offset: ["start end", "end start"],
        })
        const stopB = scrollInfo((info) => (progress.b = info.y.progress), {
            container,
            target: b.target,
            offset: ["start end", "end start"],
        })

        await nextFrame()
        resetReads(reads, a.reads, b.reads)

        await scrollContainer(container)

        expect(reads.scrollTop).toBe(1)
        expect(reads.clientHeight).toBe(1)
        expect(reads.scrollHeight).toBe(1)

        for (const target of [a, b]) {
            expect(target.reads.offsetTop).toBe(1)
            expect(target.reads.offsetParent).toBe(1)
            expect(target.reads.clientHeight).toBe(1)
        }

        /**
         * "start end" → "end start" resolves to [offsetTop - 500, offsetTop + 100],
         * so a spans [100, 700] and b spans [700, 1300].
         */
        expect(progress.a).toBeCloseTo(0.5)
        expect(progress.b).toBe(0)

        stopA()
        stopB()
    })
})
