import { motion } from "framer-motion"

export const App = () => {
    return (
        <motion.div
            id="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ width: 100, height: 100, background: "red" }}
        />
    )
}
