import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"

/**
 * Reproduction for #3141: AnimatePresence mode="wait" gets stuck
 * when state changes cause rapid key alternation.
 *
 * Exact reproduction from the issue: loading/loaded pattern where
 * useEffect immediately flips loading to false, plus mode state
 * changes that cause re-renders during exit.
 */
export const App = () => {
    const [selected, setSelected] = useState({
        key: 0,
        loading: true,
    })
    const [mode1, setMode1] = useState(false)
    const [mode2, setMode2] = useState(false)
    const [mode3, setMode3] = useState(false)

    useEffect(() => {
        if (selected.loading === true) {
            setSelected((prev) => ({ ...prev, loading: false }))
        }
    }, [selected])

    useEffect(() => {
        if (selected.loading === false) {
            setMode1((prev) => !prev)
            setMode2((prev) => !prev)
            setMode3((prev) => !prev)
        }
    }, [selected])

    useEffect(() => {
        // Rapidly cycle through keys on mount
        setSelected((prev) => ({ key: prev.key + 1, loading: true }))
        setSelected((prev) => ({ key: prev.key + 1, loading: true }))
        setSelected((prev) => ({ key: prev.key + 1, loading: true }))
        setSelected((prev) => ({ key: prev.key + 1, loading: true }))
    }, [])

    const content = useMemo(() => {
        if (selected.loading === true) {
            const key = "loading-" + selected.key
            return {
                element: <div>loading</div>,
                key,
            }
        }

        const key = "document-" + selected.key
        return {
            element: (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    loaded
                    {"mode1" + mode1}
                    {"mode2" + mode2}
                    {"mode3" + mode3}
                </div>
            ),
            key,
        }
    }, [selected, mode1, mode2, mode3])

    const content2 = useMemo(() => {
        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={content.key}
                    id="content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ ease: [0.6, 0.6, 0, 1], duration: 0.05 }}
                >
                    <span id="render-key">{"render: " + content.key}</span>
                    {content.element}
                </motion.div>
            </AnimatePresence>
        )
    }, [content.element, content.key])

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span id="current-key">{content.key}</span>
            <button
                id="change"
                onClick={() => {
                    setSelected((prev) => ({
                        key: prev.key + 1,
                        loading: true,
                    }))
                }}
            >
                Change
            </button>
            {content2}
        </div>
    )
}
