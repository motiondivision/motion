import * as React from "react"
import { useState } from "react"
import { Reorder } from "framer-motion"

type FlexLayout = "row" | "column" | "wrap" | "wrap-rtl"

const initialItems = ["a", "b", "c", "d"]

export const App = () => {
    const [items, setItems] = useState(initialItems)
    const layout = new URL(window.location.href).searchParams.get(
        "layout"
    ) as FlexLayout

    return (
        <>
            <div data-testid="current-order">{items.join(",")}</div>
            <Reorder.Group
                as="div"
                values={items}
                onReorder={setItems}
                style={{
                    display: "flex",
                    direction: layout === "wrap-rtl" ? "rtl" : "ltr",
                    flexDirection: layout === "column" ? "column" : "row",
                    flexWrap: layout.startsWith("wrap") ? "wrap" : "nowrap",
                    gap: 20,
                    width: layout.startsWith("wrap") ? 180 : "auto",
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
                            flex: "0 0 80px",
                            height: 80,
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
