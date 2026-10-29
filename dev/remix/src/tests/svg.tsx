import { motionValue } from "motion"
import { motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const

export function App() {
    const cx = motionValue(20)
    const count = motionValue(0)
    ;(window as any).setMotionValues = (x: number, n: number) => {
        cx.set(x)
        count.set(n)
    }
    return () => (
        <motion.svg
            id="svg"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={linear}
        >
            <motion.circle
                id="circle"
                cx={0}
                cy={50}
                r={20}
                initial={{ cx: 0 }}
                animate={{ cx: 100 }}
                transition={linear}
            />
            <motion.path
                id="path"
                d="M 10 150 L 190 150"
                stroke="black"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={linear}
            />
            <motion.rect
                id="rect"
                x={150}
                y={10}
                width={20}
                height={20}
                animate={{ rotate: 90 }}
                transition={linear}
            />
            <motion.circle id="mv-circle" cx={cx} cy={100} r={5} />
            <motion.text id="mv-text" x={10} y={190}>
                {count}
            </motion.text>
        </motion.svg>
    )
}
