import { motion } from "framer-motion"

/**
 * A motion component's values, for tests/react/inspect-playback.spec.ts,
 * which controls their animations through the inspector hook.
 */
const transition = { duration: 10, ease: "linear" } as const

export const App = () => (
    <motion.div
        id="box"
        style={{ width: 100, height: 100, background: "#0077ff" }}
        animate={{ x: 400, opacity: 0.5 }}
        transition={transition}
    />
)
