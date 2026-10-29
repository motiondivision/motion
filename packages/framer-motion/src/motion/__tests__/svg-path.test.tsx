import { createRef } from "react"
import { animate, motion } from "../.."
import { render } from "../../jest.setup"

/**
 * These paths have different numbers of values, so the default mixer
 * can't interpolate them and jumps straight to the target.
 */
const from = "M0 0L10 0L10 10Z"
const to = "M0 0L10 0L10 10L0 10Z"
const tagMixer = (a: string, b: string) => (p: number) =>
    p >= 1 ? b : `${a} > ${b} @ ${p}`

describe("SVG path", () => {
    test("accepts custom transition prop", async () => {
        const element = await new Promise((resolve) => {
            const ref = createRef<SVGRectElement>()
            const Component = () => (
                <motion.rect
                    ref={ref}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => resolve(ref.current)}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(element).toHaveAttribute("stroke-dashoffset", "0")
        expect(element).toHaveAttribute("stroke-dasharray", "1 1")
        expect(element).toHaveAttribute("pathLength", "1")
    })

    test("animates d with transition.mixer", async () => {
        const updates: string[] = []
        const element = await new Promise<SVGPathElement>((resolve) => {
            const ref = createRef<SVGPathElement>()
            const Component = () => (
                <svg>
                    <motion.path
                        ref={ref}
                        initial={{ d: from }}
                        animate={{ d: to }}
                        transition={{ d: { mixer: tagMixer, duration: 0.05 } }}
                        onUpdate={({ d }) => updates.push(d as string)}
                        onAnimationComplete={() => resolve(ref.current!)}
                    />
                </svg>
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(updates.some((d) => d.startsWith(`${from} > ${to} @`))).toBe(
            true
        )
        expect(element).toBeInstanceOf(SVGElement)
        expect(element).toHaveAttribute("d", to)
    })

    test("animate() animates d with transition.mixer", async () => {
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        )
        path.setAttribute("d", from)
        const updates: string[] = []

        await animate(
            path,
            { d: to },
            {
                mixer: tagMixer,
                duration: 0.05,
                onUpdate: (d: string) => updates.push(d),
            }
        )

        expect(updates.some((d) => d.startsWith(`${from} > ${to} @`))).toBe(
            true
        )
        expect(path.getAttribute("d")).toBe(to)
    })
})
