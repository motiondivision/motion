import { Reorder } from "motion/react"
import { useState } from "react"

interface Item {
    id: number
    columns: number
}

const initialItems: Item[] = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1,
    columns: (index % 3) + 1,
}))

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <main>
            <h1>Variable-width reorder flex wrap</h1>
            <p>Drag tiles between differently sized wrapped rows.</p>
            <Reorder.Group
                as="div"
                axis="xy"
                values={items}
                onReorder={setItems}
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    width: "min(90vw, 840px)",
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        as="div"
                        key={item.id}
                        value={item}
                        transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                        }}
                        whileDrag={{
                            scale: 1.04,
                            boxShadow: "0 12px 24px rgba(0, 0, 0, 0.2)",
                        }}
                        style={{
                            alignItems: "center",
                            background: `hsl(${item.id * 17} 75% 85%)`,
                            borderRadius: 8,
                            color: "#222",
                            cursor: "grab",
                            display: "flex",
                            flex: `0 0 calc((100% - 88px) / 12 * ${
                                item.columns
                            } + ${8 * (item.columns - 1)}px)`,
                            fontSize: 14,
                            fontWeight: 600,
                            height: 56,
                            justifyContent: "center",
                        }}
                    >
                        {item.id} · {item.columns}×
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            <style>{styles}</style>
        </main>
    )
}

const styles = `
body {
    background: #f2f2f2;
    margin: 0;
}

main {
    align-items: center;
    display: flex;
    flex-direction: column;
    font-family: sans-serif;
    min-height: 100vh;
    padding: 32px 0;
}

h1 {
    margin: 0;
}

p {
    color: #666;
    margin: 8px 0 24px;
}
`
