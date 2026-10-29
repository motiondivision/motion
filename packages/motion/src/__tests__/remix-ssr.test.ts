/** @jest-environment node */
import { createElement } from "remix/component"
import { renderToString } from "remix/component/server"
import { motionValue } from "framer-motion/dom"
import { AnimatePresence, motion } from "../remix"

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

    it("renders animate values with initial: false", async () => {
        const html = await render({ initial: false, animate: { opacity: 1 } })

        expect(html).toBe('<div style="opacity: 1;"></div>')
    })

    it("renders layout attributes", async () => {
        const html = await render({ layout: "position", layoutId: "tab" })

        expect(html).toContain('data-layout="position"')
        expect(html).toContain('data-layout-id="tab"')
    })

    it("renders motion components with inherited variants", async () => {
        const item = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1 } }

        function List() {
            return () =>
                createElement(
                    motion.ul,
                    {
                        id: "list",
                        initial: "hidden",
                        animate: "visible",
                        variants: {},
                    },
                    createElement(motion.li, { variants: item }, "a")
                )
        }

        const html = await renderToString(createElement(List, {}))

        expect(html).toBe(
            '<ul id="list"><li style="opacity: 0; transform: translateY(10px);">a</li></ul>'
        )
    })

    it("renders motion values and transforms in style", async () => {
        function Box() {
            return () =>
                createElement(motion.div, {
                    style: { x: motionValue(20), scale: 2, color: "red" },
                })
        }

        const html = await renderToString(createElement(Box, {}))

        expect(html).toContain("transform: translateX(20px) scale(2)")
        expect(html).toContain("color: red")
    })

    it("renders SVG initial values as attributes", async () => {
        function App() {
            return () =>
                createElement(
                    "svg",
                    {},
                    createElement(motion.circle, {
                        r: 10,
                        initial: { cx: 0, rotate: 45 },
                    }),
                    createElement(motion.path, {
                        d: "M 0 0 L 10 10",
                        initial: { pathLength: 0.5 },
                    })
                )
        }
        const html = await renderToString(createElement(App, {}))

        expect(html).toContain('cx="0"')
        expect(html).toContain('r="10"')
        expect(html).toContain("transform: rotate(45deg)")
        expect(html).toContain("transform-box: fill-box")
        expect(html).toContain('pathLength="1"')
        expect(html).toContain('stroke-dasharray="0.5 1"')
    })

    it("renders animate values inside AnimatePresence initial={false}", async () => {
        function App() {
            return () =>
                createElement(
                    AnimatePresence,
                    { initial: false },
                    createElement(motion.div, {
                        initial: { opacity: 0 },
                        animate: { opacity: 1 },
                    })
                )
        }
        const html = await renderToString(createElement(App, {}))

        expect(html).toBe('<div style="opacity: 1;"></div>')
    })
})
