import * as React from "react"
import { useState } from "react"
import { Reorder, useMotionValue } from "framer-motion"

const initialItems = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

interface ItemProps {
    item: number
}

const Item = ({ item }: ItemProps) => {
    const y = useMotionValue(0)
    const hue = item * 20

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
 * Test case for auto-scroll when the page itself is scrollable.
 * This differs from reorder-auto-scroll.tsx which uses a wrapper div
 * with overflow: auto. Here, the document/body is the scroll container.
 */
export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <>
            <div data-testid="page-container">
                <Reorder.Group axis="y" onReorder={setItems} values={items}>
                    {items.map((item) => (
                        <Item key={item} item={item} />
                    ))}
                </Reorder.Group>
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

body {
    padding: 20px;
    box-sizing: border-box;
}

ul,
li {
    list-style: none;
    padding: 0;
    margin: 0;
}

ul {
    position: relative;
    width: 300px;
    margin: 0 auto;
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
