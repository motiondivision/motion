import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { useState } from "react"

/**
 * This demonstrates container components correctly animating
 * resize when children are added/removed/expanded
 */

interface ItemProps {
    i: number
}

function Item({ i }: ItemProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <motion.div
            layout
            onClick={() => setIsOpen(!isOpen)}
            id={`container-${i}`}
            style={{
                backgroundColor: "rgba(214, 214, 214, 0.5)",
                padding: "20px",
                marginBottom: "20px",
                overflow: "hidden",
                borderRadius: 10,
            }}
        >
            <motion.div
                id={`image-${i}`}
                layout
                style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#666",
                    borderRadius: "20px",
                }}
            />
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            style={{
                                width: "200px",
                                height: "8px",
                                backgroundColor: "#999",
                                borderRadius: "10px",
                                marginTop: "12px",
                            }}
                        />
                        <motion.div
                            style={{
                                width: "200px",
                                height: "8px",
                                backgroundColor: "#999",
                                borderRadius: "10px",
                                marginTop: "12px",
                            }}
                        />
                        <motion.div
                            style={{
                                width: "200px",
                                height: "8px",
                                backgroundColor: "#999",
                                borderRadius: "10px",
                                marginTop: "12px",
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export const App = () => {
    return (
        <LayoutGroup>
            <motion.div
                initial={{ borderRadius: 25 }}
                layout
                style={{
                    width: "240px",
                    display: "flex",
                    flexDirection: "column",
                    background: "white",
                    padding: "20px",
                    borderRadius: 25,
                }}
                id="container"
            >
                {items.map((id) => (
                    <Item key={id} i={id} />
                ))}
            </motion.div>
        </LayoutGroup>
    )
}

const items = [0, 1, 2]
