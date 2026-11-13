import { Reorder, useDragControls } from "framer-motion"
import { useState } from "react"

/**
 * #4053: five items in a 320px overflow-y: auto container. Pressing an
 * item's text and dragging below the container must not make the
 * container scroll (and grow) without bound.
 *
 * ?handle=1 starts the drag from a handle with dragControls (dragListener
 * false), so the item itself has no user-select: none.
 */
const handle = new URLSearchParams(window.location.search).has("handle")

const Item = ({ item }: { item: string }) => {
    const controls = useDragControls()

    return (
        <Reorder.Item
            value={item}
            id={item.replace(" ", "-").toLowerCase()}
            dragListener={!handle}
            dragControls={controls}
            style={{
                height: 56,
                margin: "0 0 8px",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                background: "#fff",
                borderRadius: 6,
                position: "relative",
            }}
        >
            {handle ? (
                <span
                    className="handle"
                    onPointerDown={(event) => controls.start(event)}
                >
                    {item}
                </span>
            ) : (
                item
            )}
        </Reorder.Item>
    )
}

export const App = () => {
    const [items, setItems] = useState([
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
    ])

    return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <div
                id="scroll-container"
                style={{
                    height: 320,
                    width: 300,
                    overflowY: "auto",
                    background: "#ddd",
                }}
            >
                <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={setItems}
                    style={{ listStyle: "none", padding: "0 0 4px", margin: 0 }}
                >
                    {items.map((item) => (
                        <Item key={item} item={item} />
                    ))}
                </Reorder.Group>
            </div>
            <p id="control" style={{ marginTop: 40 }}>
                Control: text below the scroll container
            </p>
            <p style={{ height: 400 }}>More text below the list.</p>
        </div>
    )
}
