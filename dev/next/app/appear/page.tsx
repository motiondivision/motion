import { MotionConfig } from "motion/react"
import { appear } from "motion/react-appear"
import * as motion from "motion/react-client"

/**
 * A server component that turns CSS enter animations on for the motion
 * components below it.
 */
export default function Page() {
    return (
        <MotionConfig appear={appear}>
            <motion.div
                id="appear"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, ease: "linear" }}
                style={{ width: 100, height: 100, background: "red" }}
            />
        </MotionConfig>
    )
}
