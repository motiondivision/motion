import { Reorder } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Issue #3823: Reorder.Items that have never been dragged shouldn't be
 * offset when the window (and so the ref constraints) resizes.
 */
export const App = () => {
    const containerRef = useRef<HTMLUListElement>(null)
    const [items, setItems] = useState(["one", "two", "three", "four", "five"])
    const [selected, setSelected] = useState("one")

    return (
        <>
            <Reorder.Group
                ref={containerRef}
                axis="x"
                values={items}
                onReorder={setItems}
                style={{
                    display: "flex",
                    listStyle: "none",
                    padding: 8,
                    margin: 0,
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={item}
                        dragConstraints={containerRef}
                        style={{
                            width: 80,
                            height: 40,
                            marginRight: 8,
                            flexShrink: 0,
                            background: selected === item ? "#bcd" : "#eee",
                        }}
                    >
                        <button
                            type="button"
                            style={{ width: "100%", height: "100%" }}
                            onClick={() => setSelected(item)}
                        >
                            {item}
                        </button>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            <div id="selected">{selected}</div>
        </>
    )
}
