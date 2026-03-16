import { useRef, useState } from "react"
import { Reorder } from "framer-motion"
import { useVirtualizer } from "@tanstack/react-virtual"

const ITEM_HEIGHT = 50
const allItems = Array.from({ length: 50 }, (_, i) => `Item ${i}`)

export const App = () => {
    const [items, setItems] = useState(allItems)
    const groupRef = useRef<HTMLUListElement>(null)

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => groupRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 0,
    })

    const virtualItems = virtualizer.getVirtualItems()

    // Spacer heights to maintain correct scroll area
    const paddingTop =
        virtualItems.length > 0 ? virtualItems[0].start : 0
    const paddingBottom =
        virtualItems.length > 0
            ? virtualizer.getTotalSize() -
              virtualItems[virtualItems.length - 1].end
            : 0

    return (
        <div>
            <Reorder.Group
                ref={groupRef}
                axis="y"
                values={items}
                onReorder={setItems}
                style={{
                    height: 300,
                    overflow: "auto",
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                }}
            >
                {paddingTop > 0 && (
                    <li
                        style={{
                            height: paddingTop,
                            padding: 0,
                            border: "none",
                        }}
                    />
                )}
                {virtualItems.map((virtualItem) => {
                    const item = items[virtualItem.index]
                    return (
                        <Reorder.Item
                            key={item}
                            value={item}
                            id={item.replace(/\s/g, "-")}
                            style={{
                                height: ITEM_HEIGHT,
                                padding: "10px",
                                boxSizing: "border-box",
                                background: "#fff",
                                borderBottom: "1px solid #ccc",
                                cursor: "grab",
                            }}
                        >
                            {item}
                        </Reorder.Item>
                    )
                })}
                {paddingBottom > 0 && (
                    <li
                        style={{
                            height: paddingBottom,
                            padding: 0,
                            border: "none",
                        }}
                    />
                )}
            </Reorder.Group>
            {/* Expose state for Cypress assertions */}
            <p id="item-count" data-count={items.length}>
                {items.length} items
            </p>
            <p id="item-order" data-order={JSON.stringify(items)}>
                {items.join(", ")}
            </p>
            <p id="visible-count" data-count={virtualItems.length}>
                {virtualItems.length} visible
            </p>
        </div>
    )
}
