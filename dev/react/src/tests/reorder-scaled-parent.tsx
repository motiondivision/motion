import { motion, Reorder, useMotionValue } from "framer-motion"
import { useState } from "react"

const initialItems = [0, 1, 2, 3]

interface ItemProps {
    item: number
}

const Item = ({ item }: ItemProps) => {
    const x = useMotionValue(0)
    const hue = item * 60

    return (
        <Reorder.Item
            value={item}
            id={`item-${item}`}
            style={{
                x,
                backgroundColor: `hsl(${hue}, 70%, 50%)`,
            }}
            data-testid={`item-${item}`}
        />
    )
}

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <motion.div
            id="scaled-parent"
            style={{
                scale: 1.5,
                transformOrigin: "top left",
            }}
        >
            <Reorder.Group
                axis="x"
                onReorder={setItems}
                values={items}
                id="reorder-group"
            >
                {items.map((item) => (
                    <Item key={item} item={item} />
                ))}
            </Reorder.Group>
            <style>{styles}</style>
        </motion.div>
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
    justify-content: flex-start;
    align-items: flex-start;
}

ul,
li {
    list-style: none;
    padding: 0;
    margin: 0;
}

ul {
    position: relative;
    display: flex;
    flex-direction: row;
    gap: 10px;
}

li {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    flex-shrink: 0;
    cursor: grab;
}
`
