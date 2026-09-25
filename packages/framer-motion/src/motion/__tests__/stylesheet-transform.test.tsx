import { motion } from "../../"
import { nextFrame } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

/**
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

    test("animates x from the stylesheet transform", async () => {
        const { x } = await getOrigin({ animate: { x: 200 } })
        expect(x).toBeCloseTo(100, 0)
    })

    test("animates scale from the stylesheet transform", async () => {
        const { scale } = await getOrigin({ animate: { scale: 3 } })
        expect(scale).toBeCloseTo(2, 1)
    })

    test("animates x from the stylesheet transform with the layout prop", async () => {
        const { x } = await getOrigin({ animate: { x: 200 }, layout: true })
        expect(x).toBeCloseTo(100, 0)
    })

    test("doesn't read transformTemplate output as the origin", async () => {
        const { x } = await getOrigin({
            animate: { x: 200 },
            transformTemplate: () => "matrix(1, 0, 0, 1, -50, 0)",
        })
        expect(x).toBeCloseTo(0, 0)
    })
})
