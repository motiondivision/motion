import { AnimatePresence, motion } from "framer-motion"
import {
    forwardRef,
    memo,
    useDeferredValue,
    useState,
    useTransition,
} from "react"
import {
    SlowList as SlowListBase,
    click,
    duration,
    linear,
    mode,
    params,
    runScript,
    update,
    useCommitLog,
} from "./start-transition-helpers"

/**
 * AnimatePresence (sync / popLayout / wait) with transition-wrapped updates.
 *
 * ?mode=sync|transition|useTransition|deferred
 * ?presence=sync|popLayout|wait
 * ?scenario=remove|toggleBeforeCommit|reenterMidExit|exitDuringTransition|
 *           waitSwap|waitRapid|waitMidExit|waitExitDuringTransition
 */

const SlowList = memo(SlowListBase)
const presence = (params.get("presence") || "sync") as
    | "sync"
    | "popLayout"
    | "wait"

const exit = { opacity: 0, transition: { ...linear, duration: 0.5 } }
const layoutTransition = { layout: { ...linear, duration } }

const scenarios: Record<string, Array<[number, () => void]>> = {
    remove: [[100, click("remove-B")]],
    toggleBeforeCommit: [
        [100, click("remove-B")],
        [140, click("add-B")],
    ],
    reenterMidExit: [
        [100, click("remove-B-urgent")],
        [350, click("add-B")],
    ],
    /**
     * Run with ?slowCount=30 (~300ms renders): B's exit finishes at ~900ms,
     * while add-D's transition is rendering (~700-1000ms).
     */
    exitDuringTransition: [
        [100, click("remove-B-urgent")],
        [700, click("add-D")],
    ],
    waitSwap: [[100, click("child-B")]],
    waitRapid: [
        [100, click("child-B")],
        [130, click("child-C")],
        [160, click("child-A")],
        [190, click("child-C")],
    ],
    /**
     * Run with ?slowCount=30: A's exit finishes at ~900ms while the
     * transition switching to C is rendering (~700-1000ms).
     */
    waitExitDuringTransition: [
        [100, click("child-B-urgent")],
        [700, click("child-C")],
    ],
    waitMidExit: [
        [100, click("child-B-urgent")],
        [350, click("child-C")],
    ],
}

const Item = forwardRef<HTMLDivElement, { id: string }>(({ id }, ref) => (
    <motion.div
        ref={ref}
        id={`item-${id}`}
        data-track={`item-${id}`}
        layout
        transition={layoutTransition}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { ...linear, duration: 0.5 } }}
        exit={exit}
        style={{ width: 100, height: 100, background: "red" }}
    >
        {id}
    </motion.div>
))

export const App = () => {
    const [items, setItems] = useState(["A", "B", "C"])
    const [child, setChild] = useState("A")
    const [, start] = useTransition()
    const deferredItems = useDeferredValue(items)
    const deferredChild = useDeferredValue(child)
    const renderedItems = mode === "deferred" ? deferredItems : items
    const renderedChild = mode === "deferred" ? deferredChild : child
    useCommitLog("items", renderedItems.join(""))
    useCommitLog("child", renderedChild)

    const scenario = params.get("scenario") || "remove"
    const withoutB = (list: string[]) => list.filter((i) => i !== "B")
    const withB = (list: string[]) =>
        list.includes("B") ? list : ["A", "B", ...list.slice(1)]

    return (
        <div style={{ padding: 20 }}>
            <button
                id="run"
                onClick={() => runScript(scenarios[scenario], 1500)}
            >
                run
            </button>
            <button
                id="remove-B"
                onClick={() => update(() => setItems(withoutB), start)}
            >
                remove B
            </button>
            <button id="remove-B-urgent" onClick={() => setItems(withoutB)}>
                remove B urgent
            </button>
            <button
                id="add-B"
                onClick={() => update(() => setItems(withB), start)}
            >
                add B
            </button>
            <button
                id="add-D"
                onClick={() =>
                    update(() => setItems((l) => [...l, "D"]), start)
                }
            >
                add D
            </button>
            {["A", "B", "C"].map((c) => (
                <button
                    key={c}
                    id={`child-${c}`}
                    onClick={() => update(() => setChild(c), start)}
                >
                    child {c}
                </button>
            ))}
            <button id="child-B-urgent" onClick={() => setChild("B")}>
                child B urgent
            </button>
            {presence === "wait" ? (
                <div style={{ position: "relative" }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={renderedChild}
                            id={`child-${renderedChild}-el`}
                            className="wait-child"
                            data-track={`child-${renderedChild}`}
                            initial={{ opacity: 0 }}
                            animate={{
                                opacity: 1,
                                transition: { ...linear, duration: 0.5 },
                            }}
                            exit={exit}
                            style={{
                                width: 100,
                                height: 100,
                                background: "blue",
                            }}
                        >
                            {renderedChild}
                        </motion.div>
                    </AnimatePresence>
                </div>
            ) : (
                <div style={{ position: "relative" }}>
                    <AnimatePresence mode={presence} initial={false}>
                        {renderedItems.map((id) => (
                            <Item key={id} id={id} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
            <SlowList tick={renderedItems.join("") + renderedChild} />
        </div>
    )
}
