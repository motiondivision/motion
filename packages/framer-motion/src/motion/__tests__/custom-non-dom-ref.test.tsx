import * as React from "react"
import { motion } from "../.."
import { nextFrame } from "../../gestures/__tests__/utils"
import { render } from "../../jest.setup"

/**
 * Regression test for #2777
 *
 * When `motion()` wraps a custom component whose ref does not resolve to a DOM
 * element (e.g. the inner component is a class component, so its ref is the
 * class instance rather than a styleable element), the render loop would throw
 * `Cannot convert undefined or null to object` / `Cannot set properties of
 * undefined` when trying to write styles to `instance.style`.
 *
 * Motion should not crash the whole frame loop in this case.
 */
describe("motion() wrapping a custom component with a non-DOM ref", () => {
    test("does not throw when the inner ref is not a DOM element", async () => {
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

        expect(() => {
            render(<MotionButton initial={{ opacity: 0 }}>BUY</MotionButton>)
        }).not.toThrow()

        await nextFrame()
        await nextFrame()
    })
})
