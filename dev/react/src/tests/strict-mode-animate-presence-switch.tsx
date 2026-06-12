import { AnimatePresence, motion } from "framer-motion"
import { StrictMode, useEffect, useState } from "react"

/**
 * Reproduction for #3746.
 *
 * Inside React.StrictMode, switching between two datasets where some keys
 * persist (exist in both datasets) should animate the persistent items. Only
 * genuinely new keys should play their enter animation (width from 0).
 *
 * The bug: switching datasets re-mounts a persistent item (its key is shared
 * between datasets) because the exiting children re-ordered it in the rendered
 * list. On re-mount it replays its enter animation (width from 0) instead of
 * just translating to its new position.
 */

const mountCounts: Record<string, number> = {}
;(window as any).mountCounts = mountCounts

const datasetA = [
    { id: "a", color: "blue" },
    { id: "persist", color: "red" },
    { id: "b", color: "green" },
]

const datasetB = [
    { id: "c", color: "purple" },
    { id: "d", color: "orange" },
    { id: "persist", color: "red" },
]

function Bar({ id, color }: { id: string; color: string }) {
    useEffect(() => {
        mountCounts[id] = (mountCounts[id] || 0) + 1
    }, [])

    return (
        <motion.div
            layout
            id={`bar-${id}`}
            className="bar"
            initial={{ width: 0 }}
            animate={{ width: 200 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.4, ease: "linear" }}
            style={{
                height: 40,
                background: color,
                marginBottom: 8,
            }}
        />
    )
}

function Bars() {
    const [data, setData] = useState(datasetA)

    return (
        <div>
            <button
                id="switch"
                onClick={() =>
                    setData((d) => (d === datasetA ? datasetB : datasetA))
                }
            >
                Switch dataset
            </button>
            <div style={{ position: "relative" }}>
                <AnimatePresence>
                    {data.map((item) => (
                        <Bar key={item.id} id={item.id} color={item.color} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

export function App() {
    return (
        <StrictMode>
            <Bars />
        </StrictMode>
    )
}
