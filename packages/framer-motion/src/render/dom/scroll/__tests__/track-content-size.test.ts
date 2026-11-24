import { frame } from "motion-dom"
import { scrollInfo } from "../track"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const frames = async (count: number) => {
    for (let i = 0; i < count; i++) await nextFrame()
}

/**
 * trackContentSize polls a container's scroll size every frame. The poll
 * is for the subscribers that asked for it, so it stops when the last of
 * them unsubscribes, even while other subscribers still listen to scroll.
 */
describe("trackContentSize", () => {
    function createContainer() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        let sizeReads = 0
        for (const name of ["scrollWidth", "scrollHeight"]) {
            Object.defineProperty(container, name, {
                configurable: true,
                get: () => {
                    sizeReads++
                    return 1000
                },
            })
        }
        return { container, reads: () => sizeReads }
    }

    test("stops polling when its last subscriber leaves", async () => {
        const { container, reads } = createContainer()
        const stopTracking = scrollInfo(() => {}, {
            container,
            trackContentSize: true,
        })
        const stopOrdinary = scrollInfo(() => {}, { container })
        await frames(2)

        let before = reads()
        await frames(5)
        expect(reads()).toBeGreaterThan(before)

        stopTracking()
        await nextFrame()
        before = reads()
        await frames(5)
        expect(reads()).toBe(before)

        stopOrdinary()
    })

    test("keeps polling while another tracking subscriber remains", async () => {
        const { container, reads } = createContainer()
        const stopA = scrollInfo(() => {}, {
            container,
            trackContentSize: true,
        })
        const stopB = scrollInfo(() => {}, {
            container,
            trackContentSize: true,
        })
        await frames(2)

        stopA()
        await nextFrame()
        const before = reads()
        await frames(5)
        expect(reads()).toBeGreaterThan(before)

        stopB()
        await nextFrame()
        const after = reads()
        await frames(5)
        expect(reads()).toBe(after)
    })
})
