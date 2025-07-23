import { AnimatePresence, MotionConfig } from "motion/react"
import * as motion from "motion/react-client"
import { MotionM } from "./motion-m"
import { MotionWithRenderChildren } from "./motion"
import { MotionComponentWithChildren } from "./motion-client"

export default function Page() {
    return (
        <MotionConfig>
            <AnimatePresence>
                <MotionM />
                <motion.div
                    key="client"
                    id="motion-client"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                >
                    Hello World
                </motion.div>
            </AnimatePresence>
            <MotionWithRenderChildren />
            <MotionComponentWithChildren />
        </MotionConfig>
    )
}
