import { useRef, useState } from "react"
import { Reorder } from "framer-motion"
import { useVirtualizer } from "@tanstack/react-virtual"

const allItems = Array.from({ length: 20 }, (_, i) => `Item ${i}`)

export const App = () => {
    const [items, setItems] = useState(allItems)
    const scrollRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 60,
        overscan: 0,
    })

    // Use TanStack Virtual to determine which items to render
    const virtualItems = virtualizer.getVirtualItems()
    const startIndex =
        virtualItems.length > 0 ? virtualItems[0].index : 0
    const endIndex =
        virtualItems.length > 0
            ? virtualItems[virtualItems.length - 1].index + 1
            : 0

    // Only render the windowed slice
    const visibleItems = items.slice(startIndex, endIndex)

    return (
        <div>
            <div
                ref={scrollRef}
                style={{ height: 300, overflow: "auto" }}
            >
                <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={setItems}
                    style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                    }}
                >
                    {visibleItems.map((item) => (
                        <Reorder.Item
                            key={item}
                            value={item}
                            id={item.replace(/\s/g, "-")}
                            style={{
                                height: 50,
                                padding: "10px",
                                boxSizing: "border-box",
                                background: "#fff",
                                borderBottom: "1px solid #ccc",
                                cursor: "grab",
                            }}
                        >
                            {item}
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>
            {/* Expose state for Cypress assertions */}
            <p id="item-count" data-count={items.length}>
                {items.length} items
            </p>
            <p id="item-order" data-order={JSON.stringify(items)}>
                {items.join(", ")}
            </p>
            <p id="visible-count" data-count={visibleItems.length}>
                {visibleItems.length} visible
            </p>
        </div>
    )
}
