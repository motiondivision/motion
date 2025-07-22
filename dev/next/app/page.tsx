import { AnimatePresence, MotionConfig } from "motion/react"
import { MotionWithRenderChildren } from "./motion"
import * as motion from "motion/react-client"
import { MotionM } from "./motion-m"

export default function Page() {
    return (
        <MotionConfig>
            <AnimatePresence>
                <MotionM />
                <motion.div
                    key="client"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                >
                    Hello World
                </motion.div>
            </AnimatePresence>
            <MotionWithRenderChildren />
        </MotionConfig>
    )
}
