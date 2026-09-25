import { motion } from "framer-motion"

/**
 * Values animated without a base value must not be rendered before their
 * origin is read, or the read picks up the placeholder write (#2791).
 */
const pointPairs = [
    ["0,20 550,38", "720,38 712,50 389,50 380,36"],
    ["710,38 712,50 389,50 380,36", "850,38 830,50 400,50 390,36"],
]

export const App = () => (
    <>
        <svg width="900" height="100">
            {pointPairs.map(([from, to], i) => (
                <motion.polygon
                    key={i}
                    points={from}
                    animate={{ points: to }}
                    transition={{ delay: 0.2 * i, duration: 3, type: "spring" }}
                />
            ))}
        </svg>
        <div style={{ "--x": 50 } as React.CSSProperties}>
            <motion.div
                id="css-var"
                animate={{ "--x": 100 }}
                transition={{ ease: "linear", duration: 10 }}
            />
        </div>
    </>
)
