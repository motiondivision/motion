import { useState } from "react"
import { motion, Reorder, useMotionValue } from "framer-motion"

const initialItems = ["Tomato", "Cucumber", "Cheese", "Lettuce"]

const Item = ({ item }: { item: string }) => {
    const y = useMotionValue(0)
    return (
        <Reorder.Item value={item} id={item} style={{ y }}>
            <span id={`label-${item}`}>{item}</span>
        </Reorder.Item>
    )
}

export const App = () => {
    const [items, setItems] = useState(initialItems)
    const params = new URLSearchParams(window.location.search)
    const scale = params.get("scale") || "100%"

    return (
        <motion.div
            id="scaled-parent"
            initial={{ scale }}
            style={{ width: 300 }}
        >
            <Reorder.Group
                axis="y"
                onReorder={setItems}
                values={items}
                style={list}
            >
                {items.map((item) => (
                    <Item key={item} item={item} />
                ))}
            </Reorder.Group>
            <style>{styles}</style>
        </motion.div>
    )
}

const list: React.CSSProperties = {
    listStyle: "none",
    padding: 0,
    margin: 0,
    width: 300,
}

const styles = `
body {
  margin: 0;
  padding: 0;
  background: #ffaa00;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: sans-serif;
}

li {
  background: white;
  border-radius: 5px;
  margin-bottom: 10px;
  padding: 15px 18px;
  list-style: none;
  cursor: grab;
}
`
