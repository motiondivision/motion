import { render } from "../../jest.setup"
import { motion } from "../.."
import * as React from "react"
import { frame } from "motion-dom"

const nextFrame = () => new Promise<void>((r) => frame.postRender(() => r()))

test("transformBox written for svg transform binding", async () => {
    const ref = React.createRef<SVGRectElement>()
    const Component = () => (
        <motion.rect ref={ref} animate={{ x: 100 }} transition={{ duration: 0.05 }} />
    )
    const { rerender } = render(<Component />)
    rerender(<Component />)
    await nextFrame()
    await nextFrame()
    expect(ref.current!.style.transformBox).toBe("fill-box")
})
