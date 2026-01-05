import { motion } from "framer-motion"

/**
 * Test page for issue #1674: Inputs inside draggable elements should not trigger drag
 * when clicked/interacted with.
 */
export const App = () => {
    return (
        <div style={{ padding: 100 }}>
            <motion.div
                id="draggable"
                data-testid="draggable"
                drag
                dragElastic={0}
                dragMomentum={false}
                style={{
                    width: 200,
                    height: 100,
                    background: "red",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                }}
            >
                <input
                    type="text"
                    data-testid="input"
                    defaultValue="Select me"
                    style={{
                        width: 80,
                        height: 30,
                        padding: 5,
                    }}
                />
                <textarea
                    data-testid="textarea"
                    defaultValue="Text"
                    style={{
                        width: 60,
                        height: 30,
                        padding: 5,
                    }}
                />
            </motion.div>
        </div>
    )
}
