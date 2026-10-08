import { Reorder } from "framer-motion"
import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Regression harness for #1630: a `Reorder.Item` whose children have `layout`.
 * While an item is dragged and the order changes, the item's own layout slot
 * changes but its children must not lag behind — they have to move with it.
 *
 * Each item contains a `layout` child with a very long linear transition, so
 * any unwanted layout animation of the child is easy to spot as an offset
 * between the item and the child.
 */
const initialItems = ["a", "b", "c", "d"]

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={setItems}
            style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                position: "absolute",
                top: 0,
                left: 0,
                width: 300,
            }}
        >
            {items.map((item) => (
                <Reorder.Item
                    key={item}
                    value={item}
                    id={`item-${item}`}
                    style={{
                        height: 100,
                        width: 300,
                        background: "#ccc",
                        marginBottom: 0,
                        display: "flex",
                        alignItems: "flex-start",
                    }}
                >
                    <motion.div
                        layout
                        id={`child-${item}`}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 10,
                        }}
                        style={{
                            width: 50,
                            height: 50,
                            background: "red",
                        }}
                    >
                        <motion.div
                            layout
                            id={`grandchild-${item}`}
                            transition={{
                                type: "tween",
                                ease: "linear",
                                duration: 10,
                            }}
                            style={{
                                width: 20,
                                height: 20,
                                background: "blue",
                            }}
                        />
                    </motion.div>
                </Reorder.Item>
            ))}
        </Reorder.Group>
    )
}
