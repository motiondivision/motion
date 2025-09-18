import { domAnimation, LazyMotion } from "motion/react"
import * as m from "motion/react-m"

export const MotionM = () => {
    return (
        <LazyMotion features={domAnimation}>
            <m.div
                id="m-test"
                transition={{ type: "spring" }}
                animate={{ x: 50 }}
            >
                Hello World
            </m.div>
        </LazyMotion>
    )
}
