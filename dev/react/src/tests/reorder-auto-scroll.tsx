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

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <div
            data-testid="scroll-container"
            style={{
                height: "300px",
                overflow: "auto",
            }}
        >
            <Reorder.Group axis="y" onReorder={setItems} values={items}>
                {items.map((item) => (
                    <Item key={item} item={item} />
                ))}
            </Reorder.Group>
            <style>{styles}</style>
        </div>
    )
}

const styles = `
body {
    width: 100vw;
    height: 100vh;
    background: #333;
    overflow: hidden;
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
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
