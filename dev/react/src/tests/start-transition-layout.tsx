import { motion } from "framer-motion"
import { memo, useDeferredValue, useState, useTransition } from "react"
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
 * Layout animations driven by state updates wrapped in startTransition /
 * useTransition / useDeferredValue, with a deliberately slow render so
 * concurrent renders yield across several frames.
 *
 * ?mode=sync|transition|useTransition|deferred
 * ?scenario=basic|rapid|interrupt|midAnimation|reverseBeforeCommit
 */

const SlowList = memo(SlowListBase)
const step = 200
const layoutTransition = { layout: { ...linear, duration } }

const scenarios: Record<string, Array<[number, () => void]>> = {
    basic: [[100, click("a-next")]],
    rapid: [
        [100, click("a-next")],
        [130, click("a-next")],
        [160, click("a-next")],
    ],
    interrupt: [
        [100, click("a-next")],
        [150, click("b-urgent")],
    ],
    midAnimation: [
        [100, click("a-urgent-next")],
        [500, click("a-back")],
    ],
    reverseBeforeCommit: [
        [100, click("a-next")],
        [140, click("a-back")],
    ],
}

export const App = () => {
    const [pos, setPos] = useState(0)
    const [posB, setPosB] = useState(0)
    const [isPending, start] = useTransition()
    const deferredPos = useDeferredValue(pos)
    const renderedPos = mode === "deferred" ? deferredPos : pos

    useCommitLog("a", renderedPos)
    useCommitLog("b", posB)

    const scenario = params.get("scenario") || "basic"

    return (
        <div style={{ padding: 20 }}>
            <button id="run" onClick={() => runScript(scenarios[scenario])}>
                run
            </button>
            <button
                id="a-next"
                onClick={() => update(() => setPos((p) => p + 1), start)}
            >
                a next
            </button>
            <button
                id="a-back"
                onClick={() => update(() => setPos((p) => p - 1), start)}
            >
                a back
            </button>
            <button id="a-urgent-next" onClick={() => setPos((p) => p + 1)}>
                a urgent next
            </button>
            <button id="b-urgent" onClick={() => setPosB((p) => p + 1)}>
                b urgent
            </button>
            <span id="pending">{isPending ? "pending" : "idle"}</span>
            <div style={{ position: "relative", width: 1000 }}>
                <motion.div
                    id="a"
                    data-track="a"
                    layout
                    transition={layoutTransition}
                    style={{
                        width: 100,
                        height: 100,
                        marginLeft: renderedPos * step,
                        background: "red",
                    }}
                />
                <motion.div
                    id="b"
                    data-track="b"
                    layout
                    transition={layoutTransition}
                    style={{
                        width: 100,
                        height: 100,
                        marginLeft: posB * step,
                        background: "blue",
                    }}
                />
            </div>
            <SlowList tick={renderedPos} />
        </div>
    )
}
