import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

const color = ["red", "green"]

const shortPoems = ["1", "2"]

export function App() {
    const [items, setItems] = useState(() =>
        Array.from({ length: 2 }, (_, i) => ({
            color: color[i],
            poem: shortPoems[i],
            key: i,
        }))
    )

    return (
        <>
            <button
                id="move"
                style={{
                    marginBottom: "2rem",
                }}
                onClick={() => {
                    setItems((items) => {
                        items = [...items]
                        items.push(items.shift()!)
                        return items
                    })
                }}
            >
                Move
            </button>

            {items.map(({ color, poem, key }, i) => (
                <ListItem
                    key={key}
                    color={color}
                    poem={poem}
                    isOpen={i === 0}
                />
            ))}
        </>
    )
}

function ListItem({
    color,
    poem,
    isOpen,
}: {
    color: string
    poem: string
    isOpen: boolean
}) {
    const transition = { duration: 0.2 }

    return (
        <div className="item" style={{ backgroundColor: color }}>
            <AnimatePresence mode="wait" initial={false}>
                {isOpen ? (
                    <motion.div
                        key="content"
                        initial="hide"
                        animate="show"
                        exit="hide"
                        variants={{
                            show: {
                                opacity: 1,
                                transition,
                            },
                            hide: {
                                opacity: 0,
                                transition,
                            },
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                        }}
                    >
                        {poem}
                    </motion.div>
                ) : (
                    <div key="spacer" style={{ height: "3rem" }} />
                )}
            </AnimatePresence>
        </div>
    )
}
