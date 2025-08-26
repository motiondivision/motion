import { AnimatePresence, MotionConfig } from "motion/react"
import * as motion from "motion/react-client"
import { MotionM } from "./motion-m"
import {
    MotionCustom,
    MotionWithRenderChildren,
    MotionDiv,
} from "./client-boundary"

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
                <MotionWithRenderChildren
                    key="motion-render-children"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                />
                <MotionDiv
                    key="motion-div"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                >
                    Hello World
                </MotionDiv>
                <MotionCustom
                    key="motion-custom"
                    transition={{ type: "spring" }}
                    animate={{ x: 50 }}
                >
                    Hello World
                </MotionCustom>
            </AnimatePresence>
        </MotionConfig>
    )
}
