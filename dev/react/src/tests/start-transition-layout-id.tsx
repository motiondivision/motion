import { LayoutGroup, motion } from "framer-motion"
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
 * Shared layout (layoutId) and LayoutGroup with transition-wrapped updates.
 *
 * ?mode=sync|transition|useTransition|deferred
 * ?scenario=basic|rapid|midAnimation|group
 */

const SlowList = memo(SlowListBase)
const layoutTransition = { layout: { ...linear, duration } }
const tabWidth = 200

const scenarios: Record<string, Array<[number, () => void]>> = {
    basic: [[100, click("tab-2")]],
    rapid: [
        [100, click("tab-1")],
        [130, click("tab-2")],
        [160, click("tab-3")],
    ],
    midAnimation: [
        [100, click("tab-2-urgent")],
        [500, click("tab-0")],
    ],
    group: [[100, click("toggle-top")]],
}

function Tabs() {
    const [tab, setTab] = useState(0)
    const [, start] = useTransition()
    const deferredTab = useDeferredValue(tab)
    const renderedTab = mode === "deferred" ? deferredTab : tab
    useCommitLog("tab", renderedTab)

    return (
        <div>
            {[0, 1, 2, 3].map((i) => (
                <span key={i}>
                    <button
                        id={`tab-${i}`}
                        onClick={() => update(() => setTab(i), start)}
                    >
                        {i}
                    </button>
                    <button id={`tab-${i}-urgent`} onClick={() => setTab(i)}>
                        {i}!
                    </button>
                </span>
            ))}
            <div style={{ display: "flex", width: tabWidth * 4 }}>
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        style={{
                            width: tabWidth,
                            height: 40,
                            position: "relative",
                        }}
                    >
                        Tab {i}
                        {renderedTab === i ? (
                            <motion.div
                                layoutId="underline"
                                data-track="underline"
                                transition={layoutTransition}
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    width: tabWidth,
                                    height: 4,
                                    background: "red",
                                }}
                            />
                        ) : null}
                    </div>
                ))}
            </div>
            <SlowList tick={renderedTab} />
        </div>
    )
}

function Top() {
    const [open, setOpen] = useState(false)
    const [, start] = useTransition()
    const deferredOpen = useDeferredValue(open)
    const renderedOpen = mode === "deferred" ? deferredOpen : open
    useCommitLog("top", renderedOpen)

    return (
        <motion.div
            layout
            transition={layoutTransition}
            data-track="top"
            style={{
                width: 200,
                height: renderedOpen ? 300 : 100,
                background: "green",
            }}
        >
            <button
                id="toggle-top"
                onClick={() => update(() => setOpen((o) => !o), start)}
            >
                toggle
            </button>
            <SlowList tick={renderedOpen} />
        </motion.div>
    )
}

/**
 * Never re-renders after mount: it can only animate because it's in the
 * same LayoutGroup as Top.
 */
const Below = memo(() => (
    <motion.div
        layout
        transition={layoutTransition}
        data-track="below"
        style={{ width: 200, height: 100, background: "blue" }}
    />
))

export const App = () => {
    const scenario = params.get("scenario") || "basic"

    return (
        <div style={{ padding: 20 }}>
            <button id="run" onClick={() => runScript(scenarios[scenario])}>
                run
            </button>
            <Tabs />
            <LayoutGroup>
                <Top />
                <Below />
            </LayoutGroup>
        </div>
    )
}
