import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * Reproduction for #3746.
 *
 * A bar chart with two datasets that share a key ("persist"). Switching
 * datasets should translate the persisting bar to its new position. It should
 * never replay its enter animation (width from 0) and never re-mount.
 *
 * The reported bug appears on the *second* switch, under React.StrictMode
 * (dev/react already renders every test inside StrictMode).
 */

interface Datum {
    id: string
    value: number
    color: string
}

const datasetA: Datum[] = [
    { id: "a", value: 120, color: "blue" },
    { id: "persist", value: 200, color: "red" },
    { id: "b", value: 160, color: "green" },
]

const datasetB: Datum[] = [
    { id: "c", value: 140, color: "purple" },
    { id: "d", value: 180, color: "orange" },
    { id: "persist", value: 240, color: "red" },
]

interface PresenceDatasetState {
    mounts: Record<string, number>
    resetWidths: () => void
    minWidth: () => number
}

declare global {
    interface Window {
        presenceDataset: PresenceDatasetState
    }
}

/**
 * Sample the persisting bar every frame so the spec can assert it never
 * collapsed towards 0, rather than catching it at a single lucky moment.
 */
const widths: number[] = []

const state: PresenceDatasetState = {
    mounts: {},
    resetWidths: () => {
        widths.length = 0
    },
    minWidth: () => (widths.length ? Math.min(...widths) : -1),
}

window.presenceDataset = state

function Bar({ id, value, color }: Datum) {
    useEffect(() => {
        state.mounts[id] = (state.mounts[id] || 0) + 1
    }, [])

    return (
        <motion.div
            layout
            id={`bar-${id}`}
            initial={{ width: 0 }}
            animate={{ width: value }}
            exit={{ width: 0 }}
            transition={{ duration: 0.4, ease: "linear" }}
            style={{
                height: 40,
                marginBottom: 8,
                background: color,
            }}
        />
    )
}

export function App() {
    const [data, setData] = useState(datasetA)
    const raf = useRef(0)

    useEffect(() => {
        const sample = () => {
            const el = document.getElementById("bar-persist")
            if (el) widths.push(el.getBoundingClientRect().width)
            raf.current = requestAnimationFrame(sample)
        }
        raf.current = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf.current)
    }, [])

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
                    {data.map((datum) => (
                        <Bar key={datum.id} {...datum} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
