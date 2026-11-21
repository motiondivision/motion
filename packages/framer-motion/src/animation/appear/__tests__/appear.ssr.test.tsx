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
        expect(html).toContain("animation:m-opacity 2s linear 0s both")

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
        const html = renderToString(<motion.div animate={{ opacity: [0, 1] }} />)

        expect(html).not.toContain("animation")
        expect(html).not.toContain("data-framer-appear-id")
    })
})
