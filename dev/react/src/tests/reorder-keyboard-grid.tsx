import { Reorder } from "framer-motion"
import { useState } from "react"

/**
 * A four column grid of Reorder items, laid out by CSS grid with the axis
 * detected from the layout.
 */
export const App = () => {
    const [items, setItems] = useState(
        Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, "0"))
    )

    return (
        <>
            <button id="before">before</button>
            <div id="order">{items.join(",")}</div>
            <Reorder.Group
                as="div"
                values={items}
                onReorder={setItems}
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 60px)",
                    gap: 10,
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        as="div"
                        key={item}
                        value={item}
                        id={"item-" + item}
                        transition={{ duration: 0 }}
                        style={{ height: 60, background: "#eee" }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            <button id="after">after</button>
        </>
    )
}
