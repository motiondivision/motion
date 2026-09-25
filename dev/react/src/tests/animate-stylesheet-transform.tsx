import { motion } from "framer-motion"

const transition = { duration: 10, ease: "linear" } as const

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
        <motion.div
            id="template"
            className="box"
            style={{ width: 400 }}
            transformTemplate={(_, generated) =>
                `translateX(-50%) ${generated}`
            }
            animate={{ x: 200 }}
            transition={transition}
        />
        <motion.div
            id="rotated"
            className="box"
            initial={{ rotate: 45 }}
            animate={{ scaleX: 2 }}
            transition={transition}
            onUpdate={({ scaleX }) => {
                const { dataset } = document.getElementById("rotated")!
                dataset.origin ??= String(scaleX)
            }}
        />
    </>
)
