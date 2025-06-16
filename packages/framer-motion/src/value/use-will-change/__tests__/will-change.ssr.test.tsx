import { motionValue } from "motion-dom"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { MotionConfig, motion } from "../../../"

function runTests(render: (components: any) => string) {
    test("will-change not applied", () => {
        const div = render(
            <motion.div
                initial={
                    {
                        x: 100,
                        clipPath: "inset(10px)",
                        "--color": "#000",
                    } as any
                }
                animate={
                    {
                        x: 200,
                        clipPath: "inset(20px)",
                        "--color": "#fff",
                    } as any
                }
            />
        )

        expect(div).toBe(
            `<div style="--color:#000;clip-path:inset(10px);transform:translateX(100px)"></div>`
        )
    })

    test("will-change not set in static mode", () => {
        const div = render(
            <MotionConfig isStatic>
                <motion.div
                    initial={{ x: 100, clipPath: "inset(10px)" } as any}
                    animate={{ x: 200, clipPath: "inset(20px)" } as any}
                />
            </MotionConfig>
        )

        expect(div).toBe(
            `<div style="clip-path:inset(10px);transform:translateX(100px)"></div>`
        )
    })

    test("will-change manually set", () => {
        const div = render(
            <motion.div
                initial={{ x: 100, "--color": "#000" } as any}
                animate={{ x: 200 }}
                style={{ willChange: "opacity" }}
            />
        )

        expect(div).toBe(
            `<div style="will-change:opacity;--color:#000;transform:translateX(100px)"></div>`
        )
    })

    test("will-change manually set without animated values", () => {
        const div = render(<motion.div style={{ willChange: "opacity" }} />)

        expect(div).toBe(`<div style="will-change:opacity"></div>`)
    })

    test("will-change not set without animated values", () => {
        const div = render(<motion.div style={{}} />)

        expect(div).toBe(`<div></div>`)
    })

    test("Externally defined MotionValues not automatically added to will-change", () => {
        const opacity = motionValue(0.5)
        const div = render(<motion.div style={{ opacity }} />)

        expect(div).toBe(`<div style="opacity:0.5"></div>`)
    })

    test("will-change manually set by MotionValue", () => {
        const willChange = motionValue("opacity")
        const div = render(
            <motion.div
                initial={{ x: 100, "--color": "#000" } as any}
                animate={{ x: 200 }}
                style={{ willChange }}
            />
        )

        expect(div).toBe(
            `<div style="--color:#000;will-change:opacity;transform:translateX(100px)"></div>`
        )
    })

    test("will-change correctly not applied when isStatic", () => {
        const div = render(
            <MotionConfig isStatic>
                <motion.div
                    initial={{ x: 100, "--color": "#000" } as any}
                    animate={{ x: 200 }}
                />
            </MotionConfig>
        )

        expect(div).toBe(
            `<div style="--color:#000;transform:translateX(100px)"></div>`
        )
    })
}

describe("render", () => {
    runTests(renderToString)
})

describe("renderToStaticMarkup", () => {
    runTests(renderToStaticMarkup)
})
