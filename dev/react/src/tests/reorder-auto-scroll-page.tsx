import * as React from "react"
import { useState } from "react"
import { Reorder, useMotionValue } from "framer-motion"

const initialItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

interface ItemProps {
    item: number
}

const Item = ({ item }: ItemProps) => {
    const y = useMotionValue(0)
    const hue = item * 30

    return (
        <Reorder.Item
            value={item}
            id={String(item)}
            style={{
                y,
                backgroundColor: `hsl(${hue}, 70%, 50%)`,
            }}
            data-testid={String(item)}
        />
    )
}

/**
 * Test case for auto-scroll when the scrollable container is inside a scrollable page.
 * This tests the bug where autoscroll wouldn't trigger because the container's bounds
 * extended beyond the viewport, making the distance calculation incorrect.
 */
export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <>
            {/* Spacer to make page scrollable and push container partially off-screen */}
            <div style={{ height: "200px", background: "#222" }}>
                <p style={{ color: "#fff", padding: "20px" }}>
                    Spacer - page is scrollable
                </p>
            </div>
            <div
                data-testid="scroll-container"
                style={{
                    height: "400px",
                    overflow: "auto",
                    margin: "0 auto",
                    width: "300px",
                }}
            >
                <Reorder.Group axis="y" onReorder={setItems} values={items}>
                    {items.map((item) => (
                        <Item key={item} item={item} />
                    ))}
                </Reorder.Group>
            </div>
            {/* More spacer to ensure page is scrollable */}
            <div style={{ height: "400px", background: "#222" }}>
                <p style={{ color: "#fff", padding: "20px" }}>
                    Bottom spacer
                </p>
            </div>
            <style>{styles}</style>
        </>
    )
}

const styles = `
html, body {
    width: 100%;
    min-height: 100%;
    background: #333;
    padding: 0;
    margin: 0;
}

ul,
li {
    list-style: none;
    padding: 0;
    margin: 0;
}

ul {
    position: relative;
    width: 100%;
}

li {
    border-radius: 10px;
    margin-bottom: 10px;
    width: 100%;
    height: 60px;
    position: relative;
    border-radius: 5px;
    flex-shrink: 0;
    cursor: grab;
}
`
