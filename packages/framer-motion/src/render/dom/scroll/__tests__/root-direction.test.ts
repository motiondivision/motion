import { frame } from "motion-dom"
import { scrollInfo } from "../track"
import { ScrollInfo } from "../types"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const mock = (element: Element, name: string, value: number) =>
    Object.defineProperty(element, name, {
        configurable: true,
        get: () => value,
    })

describe("scrollInfo page direction", () => {
    test("Reads the page's writing mode and direction from <body>", async () => {
        Object.defineProperty(document, "scrollingElement", {
            value: document.documentElement,
            configurable: true,
        })
        const root = document.documentElement

        /**
         * Browsers take the viewport's writing-mode and direction from
         * <body>, but Firefox doesn't reflect that in the root element's
         * computed style.
         */
        document.body.style.direction = "rtl"
        mock(root, "clientWidth", 100)
        mock(root, "scrollWidth", 1000)
        mock(root, "scrollLeft", -450)

        let latest: ScrollInfo | undefined
        const stop = scrollInfo((info) => (latest = info))
        await nextFrame()

        expect(latest!.x.current).toBe(450)
        expect(latest!.x.progress).toBe(0.5)

        stop()
    })
})
