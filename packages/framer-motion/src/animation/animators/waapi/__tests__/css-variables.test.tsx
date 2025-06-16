import { parseCSSVariable } from "motion-dom"
import { animate, animateMini, motion } from "../../../.."
import { render } from "../../../../jest.setup"
import "./polyfill"

const fromName = "--from"
const toName = "--to"
const fromValue = "#09F"
const toValue = "#F00"
const fromVariable = `var(${fromName})`
const toVariable = `var(${toName})`

const style = {
    [fromName]: fromValue,
    [toName]: toValue,
} as React.CSSProperties

// Stub getPropertyValue because CSS variables aren't supported by JSDom

const originalGetComputedStyle = window.getComputedStyle

function getComputedStyleStub() {
    return {
        background: fromValue,
        getPropertyValue(
            variableName: "background" | "--from" | "--to" | "--a" | "--color"
        ) {
            switch (variableName) {
                case fromName:
                    return fromValue
                case toName:
                    return toValue
                case "--a":
                    return undefined
                case "--color":
                    return "  #fff "
                default:
                    throw Error("Should never happen")
            }
        },
    }
}

function stubGetComputedStyles() {
    ;(window as any).getComputedStyle = getComputedStyleStub
}

function resetComputedStyles() {
    window.getComputedStyle = originalGetComputedStyle
}

describe("css variables", () => {
    beforeAll(stubGetComputedStyles)
    afterAll(resetComputedStyles)

    test("types work", () => {
        ;() => (
            <motion.div
                initial={{ x: 0, "--from": "#f00", "--to": 0 }}
                transition={{ "--from": { duration: 1 } }}
                whileHover={{ x: 100, "--from": "#f00", "--to": 0 }}
                style={
                    {
                        "--from": "#f00",
                        "--to": 0,
                        x: 100,
                    } as React.CSSProperties
                }
            />
        )

        animate(document.createElement("div"), { x: 0, "--color": "#f00" })
        animateMini(document.createElement("div"), {
            transform: "none",
            "--color": "#f00",
        })
    })

    test("motion component still accetps React.CSSProperties", () => {
        ;() => (
            <motion.div style={{ transform: "none" } as React.CSSProperties} />
        )
    })

    test("should animate css color variables", async () => {
        const promise = new Promise((resolve) => {
            let frameCount = 0

            const Component = () => (
                <motion.div
                    style={style}
                    initial={{ background: fromVariable }}
                    animate={{ background: toVariable }}
                    onUpdate={({ background }) => {
                        frameCount += 1

                        if (frameCount > 2) resolve(background)
                    }}
                />
            )

            const { rerender } = render(<Component />)
            rerender(<Component />)
        })
        const resolvedAs = await promise

        // We're running this on the second frame to ensure and checking that
        // the resolved color *isn't* the start or target value. We want it to be an interpolation
        // of the two to ensure it's actually animating and not just switching between them.
        expect(resolvedAs).not.toBe(fromValue)
        expect(resolvedAs).not.toBe(toValue)
        expect(resolvedAs).not.toBe(fromVariable)
        expect(resolvedAs).not.toBe(toVariable)
    })

    test("should correctly animate previously unencountered variables", async () => {
        const promise = new Promise<string[]>((resolve) => {
            const output: string[] = []
            const Component = () => (
                <motion.div
                    style={{ "--color": " #fff " } as React.CSSProperties}
                    animate={{ "--a": "20px", "--color": "#000" }}
                    transition={{ duration: 0.001 }}
                    onUpdate={(latest: any) => output.push(latest)}
                    onAnimationComplete={() => resolve(output)}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        const results = await promise
        expect(results).toEqual([
            {
                "--a": "20px",
                "--color": "#000",
            },
        ])
    })

    // Skipping because this test always succeeds, no matter what style values you check for ¯\\_(ツ)_/¯
    test.skip("should have the original target css variable on animation end", async () => {
        const promise = new Promise<ChildNode | null>((resolve) => {
            const resolvePromise = () => {
                requestAnimationFrame(() => resolve(container.firstChild))
            }

            const Component = () => {
                return (
                    <motion.div
                        style={style as React.CSSProperties}
                        initial={{ background: fromVariable }}
                        animate={{ background: toVariable }}
                        // transition={{ duration: 0.01 }}
                        onAnimationComplete={resolvePromise}
                    />
                )
            }

            const { container, rerender } = render(<Component />)

            rerender(<Component />)
        })

        resetComputedStyles()
        const result = expect(promise).resolves.toHaveStyle(
            `background: ${toVariable}`
        )
        stubGetComputedStyles()
        return result
    })

    test("css variable parsing", () => {
        expect(parseCSSVariable("var(--ID-123)")).toEqual([
            "--ID-123",
            undefined,
        ])
    })

    test("css variable parsing fallback", () => {
        expect(parseCSSVariable("var(--ID-123, red)")).toEqual([
            "--ID-123",
            "red",
        ])
    })

    test("css variable parsing nested fallback", () => {
        expect(parseCSSVariable("var(--ID-123, var(--ID-234, cyan))")).toEqual([
            "--ID-123",
            "var(--ID-234, cyan)",
        ])
    })

    test("css variable parsing ignores metadata", () => {
        expect(
            parseCSSVariable('var(--ID-123) /* { "name": "whatever" } */')
        ).toEqual(["--ID-123", undefined])
    })

    test("css variable detects fallback values with decimal", () => {
        expect(
            parseCSSVariable(
                'var(--foo, rgba(255, 204, 0, 0.35)) /* {"name":"Whaa"} */'
            )
        ).toEqual(["--foo", "rgba(255, 204, 0, 0.35)"])
    })
})
