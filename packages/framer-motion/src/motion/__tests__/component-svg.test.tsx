import { useRef } from "react"
import {
    motion,
    motionValue,
    TargetAndTransition,
    useMotionValue,
    useTransform,
} from "../../"
import { nextFrame } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

describe("SVG", () => {
    test("doesn't add translateZ", () => {
        const { getByTestId } = render(
            <svg>
                <motion.g data-testid="g" initial={{ x: 100 }} />
                <motion.g data-testid="h" style={{ x: 100 }} />
            </svg>
        )

        expect(getByTestId("g")).toHaveStyle("transform: translateX(100px)")
        expect(getByTestId("h")).toHaveStyle("transform: translateX(100px)")
    })

    test("accepts attrX/attrY/attrScale in types", () => {
        render(<motion.circle animate={{ attrX: 1, attrY: 2, attrScale: 3 }} />)
    })

    test("recognises MotionValues in attributes", async () => {
        let r = motionValue(0)
        let fill = motionValue("#000")

        const Component = () => {
            r = useMotionValue(40)
            fill = useTransform(r, [40, 100], ["#00f", "#f00"])

            return (
                <svg>
                    <motion.circle
                        cx={125}
                        cy={125}
                        r={r}
                        fill={fill}
                        animate={{ r: 100 }}
                        transition={{ type: false }}
                    />
                </svg>
            )
        }

        const { rerender } = render(<Component />)
        rerender(<Component />)

        await nextFrame()

        expect(r.get()).toBe(100)
        expect(fill.get()).toBe("rgba(255, 0, 0, 1)")
    })

    test("motion svg elements should be able to set correct type of ref", () => {
        const Component = () => {
            const ref = useRef<SVGTextElement>(null)
            return (
                <svg>
                    <motion.text ref={ref}>Motion</motion.text>
                </svg>
            )
        }
        render(<Component />)
    })

    test("doesn't calculate transformOrigin for <svg /> elements", async () => {
        const Component = () => {
            return <motion.svg animate={{ rotate: 100 }} />
        }
        const { container } = render(<Component />)

        await nextFrame()

        expect(container.firstChild as Element).not.toHaveStyle(
            "transform-origin: 0px 0px"
        )
    })

    // // https://github.com/motiondivision/motion/issues/216
    test("doesn't throw if animating unencounterd value", () => {
        const animation: TargetAndTransition = {
            strokeDasharray: ["1px, 200px", "100px, 200px", "100px, 200px"],
            strokeDashoffset: [0, -15, -125],
            transition: { duration: 1.4, ease: "linear" },
        }

        const Component = () => {
            return (
                <motion.svg animate={{ rotate: 100 }}>
                    <motion.circle animate={animation} />
                </motion.svg>
            )
        }
        render(<Component />)
    })

    test("doesn't read viewBox as '0 0 0 0'", async () => {
        const Component = () => {
            return (
                <motion.svg
                    viewBox="0 0 100 100"
                    transition={{ delay: 1 }}
                    animate={{ viewBox: "100 100 200 200" }}
                />
            )
        }
        const { container } = render(<Component />)

        await nextFrame()

        expect(container.firstChild as Element).toHaveAttribute(
            "viewBox",
            "0 0 100 100"
        )
    })

    test("MotionValue can be used for transform attribute on g element", async () => {
        const Component = () => {
            const transformValue = useMotionValue("translate(50, 50)")

            return (
                <svg>
                    <motion.g transform={transformValue as any}>
                        <motion.rect width={50} height={50} />
                    </motion.g>
                </svg>
            )
        }

        const { container } = render(<Component />)

        await nextFrame()

        const gElement = container.querySelector("g")!
        // The transform should NOT be rendered as "[object Object]"
        expect(gElement.getAttribute("transform")).not.toBe("[object Object]")
        // It should be applied as a CSS style transform
        expect(gElement).toHaveStyle("transform: translate(50, 50)")
    })

    test("spring with an unset stiffness prop never renders NaN points", async () => {
        // An unset optional prop forwarded into the transition
        const Component = ({ stiffness }: { stiffness?: number }) => (
            <svg>
                <motion.polygon
                    initial={{ points: "150,5 75,200 225,200" }}
                    animate={{ points: "150,5 50,180 250,180" }}
                    transition={{ type: "spring", stiffness }}
                />
            </svg>
        )
        const { container } = render(<Component />)
        const polygon = container.querySelector("polygon")!

        const rendered: string[] = []
        const observer = new MutationObserver(() =>
            rendered.push(polygon.getAttribute("points")!)
        )
        observer.observe(polygon, { attributeFilter: ["points"] })
        for (let i = 0; i < 10; i++) await nextFrame()
        observer.disconnect()

        expect(rendered.length).toBeGreaterThan(1)
        rendered.forEach((points) =>
            points
                .split(/[ ,]/u)
                .forEach((coord) =>
                    expect(Number.isFinite(Number(coord))).toBe(true)
                )
        )
    })

    test("never writes undefined or NaN points while resolving the origin", async () => {
        const setAttribute = jest.spyOn(Element.prototype, "setAttribute")
        const pointPairs = [
            ["0,20 550,38", "720,38 712,50 389,50 380,36"],
            ["710,38 712,50 389,50 380,36", "850,38 830,50 400,50 390,36"],
        ]
        const { container } = render(
            <svg>
                {pointPairs.map(([from, to], i) => (
                    <motion.polygon
                        key={i}
                        points={from}
                        animate={{ points: to }}
                        transition={{
                            delay: 0.2 * i,
                            duration: 3,
                            type: "spring",
                        }}
                    />
                ))}
            </svg>
        )
        for (let i = 0; i < 20; i++) await nextFrame()

        const written = setAttribute.mock.calls
            .filter(([name]) => name === "points")
            .map(([, value]) => String(value))
        setAttribute.mockRestore()

        expect(written.length).toBeGreaterThan(1)
        written.forEach((points) =>
            expect(points).not.toMatch(/NaN|undefined/u)
        )
        container
            .querySelectorAll("polygon")
            .forEach((polygon) =>
                expect(polygon.getAttribute("points")).not.toMatch(
                    /NaN|undefined/u
                )
            )
    })

    test("animates viewBox", async () => {
        const Component = () => {
            return (
                <motion.svg
                    viewBox="0 0 100 100"
                    transition={{ type: false }}
                    animate={{ viewBox: "100 100 200 200" }}
                />
            )
        }
        const { container } = render(<Component />)

        await nextFrame()

        expect(container.firstChild as Element).toHaveAttribute(
            "viewBox",
            "100 100 200 200"
        )
    })
})
