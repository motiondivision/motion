import { motion } from "framer-motion"

const style = {
    width: 100,
    height: 100,
    background: "rgba(255, 0, 0, 1)",
}

export const App = () => {
    return (
        <motion.div
            whileTap="pressed"
            onTap={() => console.log("tap")}
            onTapCancel={() => console.log("tap cancel")}
        >
            <motion.div
                variants={{
                    pressed: {
                        scale: 0.5,
                        backgroundColor: "rgba(0, 255, 0, .5)",
                    },
                }}
                style={style}
            />
        </motion.div>
    )
}
