import { Reorder, useMotionValue } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Issue #2024: Reorder.Item drag position is incorrect when dragConstraints
 * is set and the (scrollable) Reorder.Group has been scrolled.
 *
 * Based on the "framer-motion 5 drag to reorder lists" example that the
 * reporter forked, with a scrollable group and dragConstraints added.
 *
 * ?constraints=ref    — dragConstraints={groupRef} (default)
 * ?constraints=object — dragConstraints={{ top: 0, bottom: 0 }}
 * ?constraints=none   — no dragConstraints (control)
 */
const initialItems = Array.from({ length: 12 }, (_, i) => i)

const Item = ({
    item,
    constraints,
}: {
    item: number
    constraints: Parameters<typeof Reorder.Item>[0]["dragConstraints"]
}) => {
    const y = useMotionValue(0)
    return (
        <Reorder.Item
            value={item}
            id={`item-${item}`}
            dragConstraints={constraints}
            style={{
                y,
                position: "relative",
                height: 60,
                marginBottom: 10,
                borderRadius: 10,
                background: "white",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                paddingLeft: 20,
            }}
        >
            {item}
        </Reorder.Item>
    )
}

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get("constraints") || "ref"
    const groupRef = useRef<HTMLUListElement>(null)
    const [items, setItems] = useState(initialItems)

    const constraints =
        mode === "ref"
            ? groupRef
            : mode === "object"
            ? { top: 0, bottom: 0 }
            : undefined

    return (
        <Reorder.Group
            ref={groupRef}
            id="group"
            axis="y"
            values={items}
            onReorder={setItems}
            style={{
                position: "relative",
                width: 300,
                height: 300,
                overflowY: "auto",
                margin: 0,
                padding: 0,
                background: "#eee",
            }}
        >
            {items.map((item) => (
                <Item key={item} item={item} constraints={constraints} />
            ))}
        </Reorder.Group>
    )
}
