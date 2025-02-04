import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

const color = ["red", "green", "blue"]

const shortPoems = [
    "A silly cat named Fred, danced on his head",
    "A rubber duck quacks wise, but only tells me lies",
    "The dishes in my sink, started to wink",
]

export function App() {
    const [items, setItems] = useState(() =>
        Array.from({ length: 3 }, (_, i) => ({
            color: color[i],
            poem: shortPoems[i],
            key: i,
        }))
    )

    return (
        <>
            <p>
                <strong>Goal:</strong> A poem should only be visible when it is
                at the top of the list.
            </p>
            <button
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
                Move top item to bottom
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
    console.log("[ListItem] render", { isOpen, poem })

    const transition = {
        opacity: { duration: 0.2 },
        height: { type: "spring", mass: 0.8 },
    }

    return (
        <div style={{ backgroundColor: color }}>
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
                                height: "auto",
                                transition,
                            },
                            hide: {
                                opacity: 0,
                                height: "3rem",
                                transition,
                            },
                        }}
                    >
                        <div
                            style={{
                                height: "5rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                            }}
                        >
                            {poem}
                        </div>
                    </motion.div>
                ) : (
                    <div key="spacer" style={{ height: "3rem" }} />
                )}
            </AnimatePresence>
        </div>
    )
}
