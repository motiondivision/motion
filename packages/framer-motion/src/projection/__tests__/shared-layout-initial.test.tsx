/**
 * Regression coverage for #2362.
 *
 * An element that mounts with the layoutId of an element that's already
 * rendered takes over from it with a shared layout animation, so visually
 * it's the same element continuing. It shouldn't replay its own
 * initial -> animate entrance.
 */

import { createRef } from "react"
import { motion } from "../../render/components/motion"
import { render } from "../../jest.setup"
import { nextFrame } from "../../gestures/__tests__/utils"

const transition = { duration: 10, ease: "linear" } as const

function Tabs({
    active,
    parentIsMotion = false,
}: {
    active?: number
    parentIsMotion?: boolean
}) {
    const Tab = parentIsMotion ? motion.div : "div"

    return (
        <>
            {[0, 1].map((index) => (
                <Tab key={index}>
                    {active === index && (
                        <motion.div
                            id={`underline-${index}`}
                            layoutId="underline"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={transition}
                        />
                    )}
                </Tab>
            ))}
        </>
    )
}

const opacityOf = (id: string) =>
    Number(document.getElementById(id)!.style.opacity)

async function settle() {
    await nextFrame()
    await nextFrame()
}

describe("layoutId takeover and initial (#2362)", () => {
    test("first mount runs its initial animation", async () => {
        render(<Tabs active={0} />)

        expect(document.getElementById("underline-0")!.style.opacity).toBe("0.001")

        await settle()
        expect(opacityOf("underline-0")).toBeGreaterThan(0)
        expect(opacityOf("underline-0")).toBeLessThan(0.5)
    })

    test("element taking over a layoutId doesn't replay its initial animation", async () => {
        const { rerender } = render(<Tabs active={0} />)
        await settle()

        rerender(<Tabs active={1} />)

        expect(document.getElementById("underline-1")!.style.opacity).toBe("1")

        await settle()
        expect(opacityOf("underline-1")).toBe(1)
    })

    test("element taking over a layoutId inside a mounted motion parent doesn't replay its initial animation", async () => {
        const { rerender } = render(<Tabs active={0} parentIsMotion />)
        await settle()

        rerender(<Tabs active={1} parentIsMotion />)

        expect(document.getElementById("underline-1")!.style.opacity).toBe("1")

        await settle()
        expect(opacityOf("underline-1")).toBe(1)
    })

    test("runs initial animation when the previous element has already gone", async () => {
        const { rerender } = render(<Tabs active={0} />)
        await settle()

        rerender(<Tabs />)
        await settle()

        rerender(<Tabs active={1} />)

        expect(document.getElementById("underline-1")!.style.opacity).toBe("0.001")

        await settle()
        expect(opacityOf("underline-1")).toBeGreaterThan(0)
        expect(opacityOf("underline-1")).toBeLessThan(0.5)
    })

    test("variant children of an element taking over start at their animate state", async () => {
        const child = createRef<HTMLDivElement>()
        const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }

        const App = ({ active }: { active: number }) => (
            <>
                {[0, 1].map((index) =>
                    active === index ? (
                        <motion.div
                            key={index}
                            layoutId="box"
                            initial="hidden"
                            animate="visible"
                            variants={variants}
                            transition={transition}
                        >
                            <motion.div
                                ref={index === 1 ? child : undefined}
                                variants={variants}
                                transition={transition}
                            />
                        </motion.div>
                    ) : null
                )}
            </>
        )

        const { rerender } = render(<App active={0} />)
        await settle()

        rerender(<App active={1} />)
        await settle()

        expect(child.current!.style.opacity).toBe("1")
    })
    test("element taking over a layoutId without initial keeps its default values", async () => {
        const App = ({ step }: { step: number }) => (
            <motion.div
                id="box"
                key={step === 0 ? "a" : "b"}
                layoutId="box"
                animate={step === 1 ? { scale: 2 } : {}}
                transition={{ type: false }}
            />
        )

        const { rerender } = render(<App step={0} />)
        await settle()

        rerender(<App step={1} />)
        await settle()

        rerender(<App step={2} />)
        await settle()

        expect(document.getElementById("box")!.style.transform).toBe("none")
    })
})
