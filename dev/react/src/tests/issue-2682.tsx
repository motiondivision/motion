import { Reorder } from "framer-motion"
import { useState } from "react"

/**
 * #2682: dragging the lower Reorder.Item above the upper one fires its
 * onClick, while dragging the upper one below the lower one doesn't.
 */
export const App = () => {
    const [items, setItems] = useState(["a", "b"])
    const [clicks, setClicks] = useState<string[]>([])

    return (
        <>
            <Reorder.Group
                axis="y"
                values={items}
                onReorder={setItems}
                style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={item}
                        onClick={() => setClicks((c) => [...c, item])}
                        style={{
                            height: 80,
                            width: 200,
                            margin: 0,
                            background: item === "a" ? "red" : "blue",
                        }}
                    />
                ))}
            </Reorder.Group>
            <div id="clicks">{clicks.join(",")}</div>
            <div id="order">{items.join(",")}</div>
        </>
    )
}
