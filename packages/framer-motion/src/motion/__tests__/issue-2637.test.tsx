import * as React from "react"
import { motion } from "../.."
import { render } from "../../jest.setup"

function createSpy() {
    const received: Record<string, unknown> = {}
    const Component = React.forwardRef<HTMLDivElement, any>((props, ref) => {
        Object.assign(received, props)
        return <div ref={ref} />
    })
    return { received, MotionComponent: motion.create(Component) as any }
}

/**
 * #2637: any prop starting with "drag" is treated as a motion prop and
 * swallowed, so custom props like "dragHandle" never reach a component
 * wrapped with motion.create().
 */
test("forwards custom drag-prefixed props to wrapped components", () => {
    const { received, MotionComponent } = createSpy()

    render(<MotionComponent dragHandle="handle" draggingLabel="label" />)

    expect(received.dragHandle).toBe("handle")
    expect(received.draggingLabel).toBe("label")
})

test("still doesn't forward Motion's own drag props", () => {
    const { received, MotionComponent } = createSpy()

    render(<MotionComponent drag="x" dragElastic={0.5} />)

    expect(received.drag).toBeUndefined()
    expect(received.dragElastic).toBeUndefined()
})
