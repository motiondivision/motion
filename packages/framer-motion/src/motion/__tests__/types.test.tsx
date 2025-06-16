import { motion, useMotionValue } from "framer-motion"
import * as clientMotion from "framer-motion/client"
import { render } from "../../jest.setup"

describe("accepts motion values into both motion components from both entry points", () => {
    it("renders", () => {
        function Component() {
            const x = useMotionValue(0)
            return (
                <>
                    <motion.div style={{ x }} />
                    <clientMotion.div style={{ x }} />
                </>
            )
        }

        render(<Component />)
    })
})
