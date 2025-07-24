import { AnimatePresence, MotionConfig } from "motion/react"
import * as motion from "motion/react-client"
import { MotionM } from "./motion-m"
import { MotionWithRenderChildren } from "./motion"

export default function Page() {
    return (
        <MotionConfig>
            <AnimatePresence>
                <MotionM key="motion-m" />
                <motion.div
                    key="client"
                    id="motion-client"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                >
                    Hello World
                </motion.div>
                <MotionWithRenderChildren key="motion-render-children" />
            </AnimatePresence>
        </MotionConfig>
    )
}
