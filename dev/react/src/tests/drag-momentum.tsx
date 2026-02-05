import { motion } from "framer-motion"

export const App = () => {
    return (
        <div style={{ height: 2000, paddingTop: 100 }}>
            <motion.div
                id="box"
                data-testid="draggable"
                drag
                dragMomentum={true}
                initial={{
                    width: 50,
                    height: 1000,
                    background: "red",
                    x: 0,
                    y: 0,
                }}
            />
        </div>
    )
}
