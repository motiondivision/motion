/** @jest-environment node */
import { createElement } from "remix/component"
import { renderToString } from "remix/component/server"
import { motion } from "../remix"

const render = (options: Parameters<typeof motion>[0], props = {}) => {
    function Box() {
        return () => createElement("div", { mix: motion(options), ...props })
    }
    return renderToString(createElement(Box, {}))
}

describe("motion/remix on the server", () => {
    it("renders initial values as styles", async () => {
        const html = await render(
            {
                initial: { opacity: 0, x: -100, scale: 0.5 },
                animate: { opacity: 1, x: 0, scale: 1 },
            },
            { style: { width: "100px" } }
        )

        expect(html).toContain("opacity: 0")
        expect(html).toContain("transform: translateX(-100px) scale(0.5)")
        expect(html).toContain("width: 100px")
    })

    it("renders the first keyframe of initial keyframes", async () => {
        const html = await render({ initial: { opacity: [0.2, 0.5] } })

        expect(html).toContain("opacity: 0.2")
    })

    it("renders nothing extra with initial: false", async () => {
        const html = await render({ initial: false, animate: { opacity: 1 } })

        expect(html).toBe("<div></div>")
    })

    it("renders layout attributes", async () => {
        const html = await render({ layout: "position", layoutId: "tab" })

        expect(html).toContain('data-layout="position"')
        expect(html).toContain('data-layout-id="tab"')
    })
})
