import * as React from "react"
import { useEffect, useState } from "react"
import { Reorder } from "framer-motion"

const initialItems = ["Tomato", "Cucumber", "Cheese", "Lettuce"]

/**
 * Reproduces #3022: Reorder.Group stops working if axis changes
 * after window resize (detected by matchMedia).
 */
export const App = () => {
    const [axis, setAxis] = useState<"x" | "y">("y")
    const [items, setItems] = useState(initialItems)

    useEffect(() => {
        const media = window.matchMedia("(min-width: 500px)")
        const change = (event: MediaQueryListEvent) => {
            setAxis(event.matches ? "x" : "y")
        }
        // Set initial axis based on current width
        setAxis(media.matches ? "x" : "y")
        media.addEventListener("change", change)
        return () => media.removeEventListener("change", change)
    }, [])

    return (
        <div>
            <div id="current-order" data-testid="current-order">
                {items.join(",")}
            </div>
            <div id="current-axis" data-testid="current-axis">
                {axis}
            </div>
            <Reorder.Group
                as="div"
                axis={axis}
                values={items}
                onReorder={setItems}
                style={{
                    display: "grid",
                    gridAutoFlow: axis === "x" ? "column" : "row",
                    gap: "10px",
                    padding: "10px",
                    listStyle: "none",
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        as="div"
                        value={item}
                        data-testid={item}
                        style={{
                            padding: "20px",
                            background: "#eee",
                            cursor: "grab",
                            minWidth: "80px",
                            minHeight: "50px",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            <style>{`
                body {
                    margin: 0;
                    padding: 20px;
                }
            `}</style>
        </div>
    )
}
