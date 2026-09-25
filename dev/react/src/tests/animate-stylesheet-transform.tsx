import { motion } from "framer-motion"

const transition = { duration: 4, ease: "linear" } as const

export const App = () => (
    <>
        <style>{`
            .box { width: 50px; height: 50px; background: red; }
            .translated { transform: translateX(100px); }
            .scaled { transform: scale(2); }
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
            id="scale"
            className="box scaled"
            animate={{ scale: 3 }}
            transition={transition}
        />
    </>
)
