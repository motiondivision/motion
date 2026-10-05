import * as React from "react"
import { useState } from "react"
import { Reorder } from "framer-motion"

/**
 * Issue #2255: Reorder.Group with axis="x" whose items wrap onto multiple
 * rows. Dragging an item into another row changes its layout on the y axis,
 * which the drag gesture compensates for by writing to the item's y value,
 * even though y isn't a drag axis. After release only x snaps back to the
 * origin, leaving a stale translateY on the item.
 */
const initial = ["apple", "banana", "kiwi", "watermelon", "fig", "grape", "pear"]

export const App = () => {
    const [items, setItems] = useState(initial)
    const axis = new URL(window.location.href).searchParams.get("axis")

    return (
        <>
            <div data-testid="order">{items.join(",")}</div>
            <Reorder.Group
                axis={axis === "auto" ? undefined : "x"}
                values={items}
                onReorder={setItems}
                data-testid="group"
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    width: 300,
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        data-testid={item}
                        transition={{ duration: 0.1 }}
                        style={{
                            background: "#ddd",
                            padding: 10,
                            height: 20,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </>
    )
}
