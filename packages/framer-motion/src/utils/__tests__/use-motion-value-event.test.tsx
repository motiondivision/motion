import { render } from "../../jest.setup"
import { useMotionValue } from "../../value/use-motion-value"
import { useMotionValueEvent } from "../use-motion-value-event"

describe("useMotionValueEvent", () => {
    test("useMotionValueEvent infers type for change callback", () => {
        const Component = () => {
            const x = useMotionValue(0)
            useMotionValueEvent(x, "change", (latest) => latest / 2)
            return null
        }

        render(<Component />)
    })
})
