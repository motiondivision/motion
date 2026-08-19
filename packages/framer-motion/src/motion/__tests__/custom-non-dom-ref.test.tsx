import * as React from "react"
import { motion } from "../.."
import { render } from "../../jest.setup"

/**
 * Regression test for #2777
 *
 * When `motion.create()` wraps a custom component whose ref doesn't resolve to
 * a DOM element (e.g. the inner component is a class component, so its ref is
 * the class instance rather than a styleable element), the render loop would
 * throw `Cannot convert undefined or null to object` from deep inside the
 * frame loop, breaking every animation on the page.
 *
 * Motion should instead throw an actionable invariant at mount.
 */
describe("motion.create() wrapping a custom component with a non-DOM ref", () => {
    let consoleError: jest.SpyInstance

    beforeEach(() => {
        // React logs uncaught errors thrown from refs, which is noise here.
        consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => consoleError.mockRestore())

    test("throws an actionable invariant when the ref isn't an element", () => {
        class ClassButton extends React.Component<any> {
            render() {
                return <button>{this.props.children}</button>
            }
        }

        // Forwards the ref to a class component, so the mounted instance is the
        // class instance (no `.style`), mirroring the NextUI Button repro.
        const AnimateButton = React.forwardRef<any, any>((props, ref) => (
            <ClassButton ref={ref} {...props} />
        ))

        const MotionButton = motion.create(AnimateButton)

        expect(() =>
            render(<MotionButton initial={{ opacity: 0 }}>BUY</MotionButton>)
        ).toThrowError(
            "motion.create() components must forward their ref to a HTML or SVG element. For more information and steps for solving, visit https://motion.dev/troubleshooting/custom-component-ref"
        )
    })

    test("mounts without error when the ref resolves to an element", () => {
        const AnimateButton = React.forwardRef<HTMLButtonElement, any>(
            (props, ref) => <button ref={ref} {...props} />
        )

        const MotionButton = motion.create(AnimateButton)

        expect(() =>
            render(<MotionButton initial={{ opacity: 0 }}>BUY</MotionButton>)
        ).not.toThrow()
    })
})
