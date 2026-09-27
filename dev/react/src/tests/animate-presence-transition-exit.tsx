import { AnimatePresence, motion } from "framer-motion"
import {
    memo,
    startTransition,
    useLayoutEffect,
    useState,
    useTransition,
} from "react"

/**
 * A child is added in a transition while another child's exit animation
 * completes mid-render of that transition.
 *
 * ?mode=sync|popLayout
 * ?transition=start|use
 */
const params = new URLSearchParams(window.location.search)
const mode = (params.get("mode") || "sync") as "sync" | "popLayout"
const useHook = params.get("transition") === "use"

const log: Record<string, number> = {}
;(window as any).__log = log
const mark = (name: string) => {
    if (log[name] === undefined) log[name] = performance.now()
}

function busy(ms: number) {
    const end = performance.now() + ms
    while (performance.now() < end) {}
}

/**
 * React yields between fibers every ~5ms in concurrent renders, so this makes
 * a transition render span ~500ms of frames (doubled by StrictMode).
 */
const Slow = () => {
    busy(5)
    return null
}

const SlowList = memo(({ hasD }: { hasD: boolean }) => {
    if (hasD) mark("transitionRender")
    return (
        <div style={{ display: "none" }}>
            {Array.from({ length: 50 }, (_, i) => (
                <Slow key={i} />
            ))}
        </div>
    )
})

export const App = () => {
    const [items, setItems] = useState(["A", "B", "C"])
    const [, start] = useTransition()
    const key = items.join("")

    useLayoutEffect(() => {
        if (key === "ACD") mark("transitionCommit")
    }, [key])

    return (
        <div style={{ position: "relative" }}>
            <button
                id="remove"
                onClick={() => setItems((l) => l.filter((i) => i !== "B"))}
            >
                remove B
            </button>
            <button
                id="add"
                onClick={() =>
                    (useHook ? start : startTransition)(() =>
                        setItems((l) => [...l, "D"])
                    )
                }
            >
                add D
            </button>
            <div id="state">{key}</div>
            <AnimatePresence
                mode={mode}
                initial={false}
                onExitComplete={() => mark("exitComplete")}
            >
                {items.map((id) => (
                    <motion.div
                        key={id}
                        id={`item-${id}`}
                        className="item"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "linear" }}
                        style={{ width: 100, height: 100, background: "red" }}
                    />
                ))}
            </AnimatePresence>
            <SlowList hasD={items.includes("D")} />
        </div>
    )
}
