import * as React from "react"
import { useState } from "react"
import { Reorder } from "framer-motion"

const initialItems = ["a", "b", "c", "d"]

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <>
            <div data-testid="current-order">{items.join(",")}</div>
            <Reorder.Group
                as="div"
                values={items}
                onReorder={setItems}
                style={{
                    display: "grid",
                    gridTemplateColumns: "100px 100px",
                    gap: 10,
                    width: 210,
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        as="div"
                        key={item}
                        value={item}
                        data-testid={item}
                        transition={{ duration: 0 }}
                        style={{
                            alignItems: "center",
                            background: "#eee",
                            display: "flex",
                            height: 100,
                            justifyContent: "center",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </>
    )
}
