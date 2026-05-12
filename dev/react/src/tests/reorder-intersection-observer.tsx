import { useEffect, useRef, useState } from "react"
import { Reorder } from "framer-motion"

interface IntersectionLog {
    id: string
    isIntersecting: boolean
    time: number
}

export const App = () => {
    const [items, setItems] = useState([
        "Test 1",
        "Test 2",
        "Test 3",
        "Test 4",
        "Test 5",
    ])
    const [logs, setLogs] = useState<IntersectionLog[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = containerRef.current
        if (!root) return

        const observer = new IntersectionObserver(
            (entries) => {
                const time = performance.now()
                setLogs((prev) => [
                    ...prev,
                    ...entries.map((entry) => ({
                        id: (entry.target as HTMLElement).id,
                        isIntersecting: entry.isIntersecting,
                        time,
                    })),
                ])
            },
            { root, threshold: 0 }
        )

        const targets = root.querySelectorAll<HTMLElement>("[data-observed]")
        targets.forEach((el) => observer.observe(el))

        return () => observer.disconnect()
    }, [])

    return (
        <div>
            <div
                ref={containerRef}
                style={{
                    height: 400,
                    overflow: "auto",
                    border: "1px solid #333",
                }}
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
                    {items.map((item) => (
                        <Reorder.Item
                            key={item}
                            value={item}
                            id={item.replace(/\s/g, "-")}
                            data-observed
                            style={{
                                height: 80,
                                padding: 10,
                                boxSizing: "border-box",
                                background: "#eef",
                                borderBottom: "1px solid #99c",
                                cursor: "grab",
                            }}
                        >
                            {item}
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>
            <div
                id="log-state"
                data-count={logs.length}
                data-log={JSON.stringify(logs)}
            />
        </div>
    )
}
