import { motion } from "framer-motion"

/**
 * Independent transforms (x, scale...) never animate from a stylesheet
 * transform: a computed matrix has no sound decomposition into them. They
 * animate from their own value (default, initial or style), while
 * `transform` animates from `transform`.
 */
const transition = { duration: 10, ease: "linear" } as const

export const App = () => (
    <>
        <style>{`
            .box { width: 50px; height: 50px; background: red; }
            .translated { transform: translateX(300px); }
        `}</style>
        <motion.div
            id="x"
            className="box translated"
            animate={{ x: 200 }}
            transition={transition}
        />
        <motion.div
            id="layout-x"
            className="box translated"
            layout
            animate={{ x: 200 }}
            transition={transition}
        />
        <motion.div
            id="style-x"
            className="box translated"
            style={{ x: 50 }}
            animate={{ x: 250 }}
            transition={transition}
        />
        <motion.div
            id="transform"
            className="box translated"
            animate={{ transform: "translateX(500px)" }}
            transition={transition}
        />
    </>
)
