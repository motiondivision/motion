import { version } from "react"
import { renderToString } from "react-dom/server"
import { stagger } from "motion-dom"
import { appear } from "../../../appear"
import { motion } from "../../../async"
import { MotionConfig } from "../../../components/MotionConfig"

const render = (children: any, config: any = {}) =>
    renderToString(
        <MotionConfig appear={appear} {...config}>
            {children}
        </MotionConfig>
    )

const linear = { duration: 2, ease: "linear" } as const

describe("appear motion components", () => {
    test("render their enter animation on the server", () => {
        const html = render(
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
        const html = render(<motion.div animate={{ opacity: 1 }} />)

        expect(html).toBe("<div></div>")
    })

    test("turn the page's CSS enter animations off when CSS can't run one", () => {
        const html = render(
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
        render(
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

    const enter = (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={linear}
        />
    )

    test("render as before without the config", () => {
        expect(renderToString(enter)).toBe('<div style="opacity:0"></div>')
    })

    test("leave out CSS that the config's other options turn off", () => {
        expect(render(enter, { skipAnimations: true })).not.toContain(
            "animation:"
        )
        expect(render(enter, { reducedMotion: "always" })).not.toContain(
            "animation:"
        )

        // The reader's own setting is known only to their browser
        const html = render(enter, { reducedMotion: "user" })
        expect(html).toContain("animation:")
        parseInt(version) > 18 &&
            expect(html).toContain(
                "@media (prefers-reduced-motion:reduce){:root{--m:none}}"
            )
    })
})
