import { version } from "react"
import { renderToString } from "react-dom/server"
import { motion } from "../../../appear"

const linear = { duration: 2, ease: "linear" } as const

describe("appear motion components", () => {
    test("render their enter animation on the server", () => {
        const html = renderToString(
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={linear}
            />
        )

        expect(html).not.toContain("data-framer-appear-id")
        expect(html).toContain("opacity:0")
        expect(html).toContain("--m-opacity:1")
        // --m is how a page turns its CSS enter animations off
        expect(html).toContain("animation:var(--m,m-opacity 2s linear 0s both)")

        /**
         * React 19 renders the rule too. Before it, the rule is added
         * when the component mounts.
         */
        const rule = "@keyframes m-opacity{to{opacity:var(--m-opacity)}}"
        parseInt(version) > 18
            ? expect(html).toContain(rule)
            : expect(html).not.toContain(rule)
    })

    test("render as before when there is no enter animation", () => {
        const html = renderToString(<motion.div animate={{ opacity: 1 }} />)

        expect(html).toBe("<div></div>")
    })

    test("turn the page's CSS enter animations off when CSS can't run one", () => {
        const html = renderToString(
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 1] }}
            />
        )

        expect(html).not.toContain("animation:")
        expect(html).not.toContain("data-framer-appear-id")

        const rule = ":root{--m:none}"
        parseInt(version) > 18
            ? expect(html).toContain(rule)
            : expect(html).not.toContain(rule)
    })
})
