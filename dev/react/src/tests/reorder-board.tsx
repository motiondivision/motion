import { Reorder } from "framer-motion"
import { useState } from "react"

/**
 * Reorder.Board: items can be dragged, or grabbed with Space and moved with
 * the arrow keys, between its columns.
 */
const initial: Record<string, string[]> = {
    todo: ["a", "b", "c"],
    doing: ["d", "e"],
    done: [],
}

export const App = () => {
    const [columns, setColumns] = useState(initial)
    const [drags, setDrags] = useState({ start: 0, end: 0 })

    return (
        <>
            <div data-testid="state">
                {Object.keys(columns)
                    .map((id) => `${id}:${columns[id].join(",")}`)
                    .join(" ")}
            </div>
            <div data-testid="drags">{`${drags.start},${drags.end}`}</div>
            <Reorder.Board>
                <div style={{ display: "flex", gap: 50, padding: 50 }}>
                    {Object.keys(columns).map((id) => (
                        <Reorder.Group
                            key={id}
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
                                height: 300,
                                background: "#eee",
                            }}
                        >
                            {columns[id].map((item) => (
                                <Reorder.Item
                                    key={item}
                                    value={item}
                                    data-testid={item}
                                    whileDrag={{
                                        scale: 1.2,
                                        transition: { duration: 0.2 },
                                    }}
                                    onDragStart={() =>
                                        setDrags((d) => ({
                                            ...d,
                                            start: d.start + 1,
                                        }))
                                    }
                                    onDragEnd={() =>
                                        setDrags((d) => ({
                                            ...d,
                                            end: d.end + 1,
                                        }))
                                    }
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
                    ))}
                </div>
            </Reorder.Board>
        </>
    )
}
