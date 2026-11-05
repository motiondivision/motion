import { Reorder } from "framer-motion"
import { useState } from "react"

/**
 * Reorder.Board in a page that scrolls, with columns that scroll and hold
 * more items than they show. Scroll the page and the columns, then drag
 * items between columns.
 */
const make = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`)

export const App = () => {
    const [columns, setColumns] = useState<Record<string, string[]>>(() => ({
        A: make("a", 12),
        B: make("b", 12),
        C: make("c", 3),
    }))

    return (
        <div style={{ paddingTop: 800, paddingBottom: 1200 }}>
            <div data-testid="state">
                {Object.keys(columns)
                    .map((id) => `${id}:${columns[id].join(",")}`)
                    .join(" ")}
            </div>
            <Reorder.Board>
                <div style={{ display: "flex", gap: 50, padding: 50 }}>
                    {Object.keys(columns).map((id) => (
                        <div
                            key={id}
                            data-testid={`scroll-${id}`}
                            style={{
                                flexShrink: 0,
                                height: 300,
                                overflowY: "auto",
                                background: "#eee",
                            }}
                        >
                            <Reorder.Group
                                axis="y"
                                values={columns[id]}
                                onReorder={(order) =>
                                    setColumns((latest) => ({
                                        ...latest,
                                        [id]: order,
                                    }))
                                }
                                data-testid={id}
                                style={{
                                    listStyle: "none",
                                    margin: 0,
                                    padding: 10,
                                    width: 100,
                                    minHeight: 280,
                                }}
                            >
                                {columns[id].map((item) => (
                                    <Reorder.Item
                                        key={item}
                                        value={item}
                                        data-testid={item}
                                        whileDrag={{ scale: 1.1 }}
                                        style={{
                                            position: "relative",
                                            height: 50,
                                            marginBottom: 10,
                                            background: "#09f",
                                            color: "white",
                                        }}
                                    >
                                        {item}
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </div>
                    ))}
                </div>
            </Reorder.Board>
        </div>
    )
}
