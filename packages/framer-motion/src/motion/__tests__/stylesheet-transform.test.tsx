import { motion } from "../../"
import { nextFrame } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

/**
 * Independent transforms never animate from a stylesheet transform: a
 * computed matrix has no sound decomposition into x, scale etc. They animate
 * from their own value (default, initial or style), while `transform`
 * animates from `transform`.
 *
 * JSDOM cascades stylesheet declarations into getComputedStyle but doesn't
 * resolve transforms into a matrix, so the stylesheet declares one directly.
 */
describe("stylesheet transforms", () => {
    let sheet: HTMLStyleElement

    beforeEach(() => {
        sheet = document.createElement("style")
        sheet.textContent = ".box { transform: matrix(2, 0, 0, 2, 100, 0) }"
        document.head.appendChild(sheet)
    })

    afterEach(() => sheet.remove())

    async function getOrigin(props: Record<string, unknown>) {
        const origins: Record<string, unknown> = {}
        render(
            <motion.div
                className="box"
                {...props}
                transition={{ duration: 10, ease: "linear" }}
                onUpdate={(latest) => {
                    for (const key in latest) {
                        if (!(key in origins)) origins[key] = latest[key]
                    }
                }}
            />
        )
        await nextFrame()
        await nextFrame()
        return origins
    }

    test("independent transforms animate from their default", async () => {
        const { x, scale } = await getOrigin({ animate: { x: 200, scale: 3 } })
        expect(x).toBeCloseTo(0, 0)
        expect(scale).toBeCloseTo(1, 1)
    })

    test("independent transforms animate from their default with layout", async () => {
        const { x } = await getOrigin({ animate: { x: 200 }, layout: true })
        expect(x).toBeCloseTo(0, 0)
    })

    test("independent transforms animate from style", async () => {
        const { x } = await getOrigin({ animate: { x: 200 }, style: { x: 50 } })
        expect(x).toBeCloseTo(50, 0)
    })

    test("independent transforms animate from their default on hover", async () => {
        const { container } = render(
            <motion.div
                className="box"
                whileHover={{ x: 200 }}
                transition={{ duration: 10, ease: "linear" }}
            />
        )
        const element = container.firstChild as HTMLElement
        const read = jest.spyOn(window, "getComputedStyle")
        element.dispatchEvent(
            new PointerEvent("pointerenter", { pointerType: "mouse" } as any)
        )
        await nextFrame()
        await nextFrame()
        read.mockRestore()

        expect(read).not.toHaveBeenCalled()
        expect(element.style.transform).toMatch(/^translateX\(0\.\d+px\)$/u)
    })

    test("transform animates from the stylesheet transform", async () => {
        const { transform } = await getOrigin({
            animate: { transform: "matrix(1, 0, 0, 1, 200, 0)" },
        })
        const [scale, , , , x] = String(transform)
            .match(/matrix\((.+)\)/u)![1]
            .split(",")
            .map(parseFloat)
        expect(scale).toBeCloseTo(2, 1)
        expect(x).toBeCloseTo(100, 0)
    })
})
