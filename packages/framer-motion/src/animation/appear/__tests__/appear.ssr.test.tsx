import { version } from "react"
import { renderToString } from "react-dom/server"
import { stagger } from "motion-dom"
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

    const list = (transition: any, child: any = {}) =>
        renderToString(
            <motion.ul
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition },
                }}
            >
                {[0, 1, 2].map((index) => (
                    <motion.li
                        key={index}
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: linear,
                                ...child,
                            },
                        }}
                    />
                ))}
            </motion.ul>
        )

    const delays = (html: string) =>
        [
            ...html.matchAll(
                /<li style="[^"]*m-opacity 2s linear (\S+)s both/g
            ),
        ].map((match) => parseFloat(match[1]))

    test("stagger children that take a parent's variants", () => {
        expect(
            delays(list({ ...linear, delayChildren: stagger(0.1) }))
        ).toEqual([0, 0.1, 0.2])

        expect(
            delays(
                list({
                    ...linear,
                    delayChildren: stagger(0.1, { startDelay: 1 }),
                })
            )
        ).toEqual([1, 1.1, 1.2])

        expect(delays(list({ ...linear, delayChildren: 0.5 }))).toEqual([
            0.5, 0.5, 0.5,
        ])

        // After the parent's own animation
        expect(
            delays(
                list({
                    ...linear,
                    when: "beforeChildren",
                    delayChildren: stagger(0.1),
                })
            )
        ).toEqual([2, 2.1, 2.2])
    })

    test("wait for the animation code when a stagger needs the number of children", () => {
        for (const transition of [
            { delayChildren: stagger(0.1, { from: "last" }) },
            { delayChildren: stagger(0.1, { from: "center" }) },
            { when: "afterChildren" },
        ]) {
            const html = list({ ...linear, ...transition })

            // The children wait, and turn the parent's animation off
            expect(html).not.toMatch(/<li style="[^"]*animation/)
            parseInt(version) > 18 && expect(html).toContain(":root{--m:none}")
        }
    })
})
