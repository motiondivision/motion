import { motion } from "motion/react"
import * as motionClient from "motion/react-client"
import { ReactNode } from "react"

function Component({
    children,
    ref,
}: {
    children: (p: { test: boolean }) => ReactNode
    ref: React.Ref<HTMLDivElement>
}) {
    return <div ref={ref}>{children({ test: true })}</div>
}

const MotionComponent = motion.create(Component)

export const App = () => {
    return (
        <div>
            <motion.div
                style={{
                    position: "absolute",
                    backgroundColor: "black",
                    width: "10px",
                    height: "10px",
                }}
                className="motion-div"
                animate={{ left: [0, 100, 0] }}
                transition={{
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.5, 1],
                    ease: "easeInOut",
                }}
                onClick={(event) => event.stopPropagation()}
            ></motion.div>
            <motionClient.div onClick={(event) => event.stopPropagation()} />
            <MotionComponent>{({ test }) => <div>{test}</div>}</MotionComponent>
            <button>Disable animation</button>
        </div>
    )
}
