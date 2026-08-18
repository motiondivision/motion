import { Reorder } from "motion/react"
import { useState } from "react"

const initialItems = Array.from({ length: 100 }, (_, index) => index + 1)

export const App = () => {
    const [items, setItems] = useState(initialItems)

    return (
        <main>
            <h1>Reorder grid</h1>
            <p>Drag any tile to a new position.</p>
            <Reorder.Group
                as="div"
                axis="xy"
                values={items}
                onReorder={setItems}
                style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(10, 1fr)",
                    width: "min(90vw, 720px)",
                }}
            >
                {items.map((item) => (
                    <Reorder.Item
                        as="div"
                        key={item}
                        value={item}
                        transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                        }}
                        whileDrag={{
                            scale: 1.08,
                            boxShadow: "0 12px 24px rgba(0, 0, 0, 0.2)",
                        }}
                        style={{
                            alignItems: "center",
                            aspectRatio: 1,
                            background: "#fff",
                            borderRadius: 8,
                            color: "#222",
                            cursor: "grab",
                            display: "flex",
                            fontSize: 14,
                            fontWeight: 600,
                            justifyContent: "center",
                        }}
                    >
                        {item}
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
