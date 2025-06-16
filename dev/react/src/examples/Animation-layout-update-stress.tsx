import { motion, useCycle } from "framer-motion"

/**
 * This is an example used to stress-test the updateDelta algorithm
 */

const maxChildren = 4
const maxDepth = 2
function layoutChildren(currentDepth: number) {
    const children = []

    for (let i = 0; i < maxChildren; i++) {
        children.push(
            <motion.div
                layout
                key={i}
                style={{
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "stretch",
                    backgroundColor:
                        currentDepth === 0
                            ? "red"
                            : currentDepth === 1
                            ? "blue"
                            : "green",
                    width: "25%",
                    height: "25%",
                }}
            >
                {currentDepth < maxDepth && layoutChildren(currentDepth + 1)}
            </motion.div>
        )
    }

    return children
}

export const App = () => {
    const [isOpen, toggleIsOpen] = useCycle(true, false)

    return (
        <motion.div
            layout
            onClick={() => toggleIsOpen()}
            style={{
                width: "500px",
                height: "500px",
                background: "white",
                display: "flex",
                alignItems: isOpen ? "flex-end" : "stretch",
                justifyContent: "stretch",
            }}
        >
            {layoutChildren(0)}
        </motion.div>
    )
}
