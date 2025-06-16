import { motion } from "framer-motion"

export const App = () => {
    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <motion.div
                id="box"
                transition={{
                    duration: 0.5,
                    delay: 2,
                    ease: (x: number) => x,
                }}
                initial={{ transform: "scale(1)" }}
                animate={{ transform: "scale(1)" }}
                style={{
                    width: "100px",
                    height: "100px",
                    position: "relative",
                    backgroundColor: "red",
                    opacity: 1,
                }}
            >
                Content
            </motion.div>
        </section>
    )
}
