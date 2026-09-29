import { LayoutGroup, motion } from "framer-motion"
import { Suspense, useDeferredValue, useState, useTransition } from "react"
import {
    click,
    duration,
    linear,
    log,
    mode,
    params,
    runScript,
    update,
    useCommitLog,
} from "./start-transition-helpers"

/**
 * Suspense inside a transition, with a `layout` parent whose size depends on
 * the suspended content.
 *
 * swap:   an already-visible boundary switches to content that suspends.
 * expand: a new boundary mounts and suspends.
 * expandGroup: as expand, but the card is in a LayoutGroup and the fallback
 *   and content are `layout` motion components, so the fallback unmounting
 *   snapshots the group before the reveal.
 *
 * ?mode=sync|transition|useTransition|deferred
 * ?scenario=swap|expand|expandGroup
 */

const scenario = params.get("scenario") || "swap"
const group = scenario === "expandGroup"
const Wrapper = group ? motion.div : "div"

const heights: Record<number, number> = { 1: 100, 2: 300 }
const cache = new Map<number, { done: boolean; promise: Promise<void> }>()
cache.set(1, { done: true, promise: Promise.resolve() })

function read(id: number) {
    let entry = cache.get(id)
    if (!entry) {
        const created = {
            done: false,
            promise: new Promise<void>((resolve) =>
                setTimeout(() => {
                    created.done = true
                    log("resolved", id)
                    resolve()
                }, 400)
            ),
        }
        entry = created
        cache.set(id, entry)
    }
    if (!entry.done) throw entry.promise
}

function Details({ id }: { id: number }) {
    read(id)
    useCommitLog("details", id)
    return (
        <Wrapper
            id={`details-${id}`}
            layout={group || undefined}
            style={{ height: heights[id] }}
        >
            details {id}
        </Wrapper>
    )
}

const Fallback = () => {
    useCommitLog("fallback", true)
    return (
        <Wrapper layout={group || undefined} style={{ height: 50 }}>
            loading
        </Wrapper>
    )
}

const scenarios: Record<string, Array<[number, () => void]>> = {
    swap: [[100, click("next")]],
    expand: [[100, click("expand")]],
    expandGroup: [[100, click("expand")]],
}

export const App = () => {
    const [id, setId] = useState(1)
    const [expanded, setExpanded] = useState(false)
    const [isPending, start] = useTransition()
    const deferredId = useDeferredValue(id)
    const deferredExpanded = useDeferredValue(expanded)
    const renderedId = mode === "deferred" ? deferredId : id
    const renderedExpanded = mode === "deferred" ? deferredExpanded : expanded
    useCommitLog("card", { renderedId, renderedExpanded, isPending })

    return (
        <div style={{ padding: 20 }}>
            <button id="run" onClick={() => runScript(scenarios[scenario])}>
                run
            </button>
            <button id="next" onClick={() => update(() => setId(2), start)}>
                next
            </button>
            <button
                id="expand"
                onClick={() => update(() => setExpanded(true), start)}
            >
                expand
            </button>
            <LayoutGroup>
                <motion.div
                    id="card"
                    data-track="card"
                    layout
                    transition={{ layout: { ...linear, duration } }}
                    style={{
                        width: 200,
                        background: "#ccc",
                        overflow: "hidden",
                    }}
                >
                    {scenario === "swap" ? (
                        <Suspense fallback={<Fallback />}>
                            <Details id={renderedId} />
                        </Suspense>
                    ) : (
                        <>
                            <div style={{ height: 100 }}>header</div>
                            {renderedExpanded ? (
                                <Suspense fallback={<Fallback />}>
                                    <Details id={2} />
                                </Suspense>
                            ) : null}
                        </>
                    )}
                </motion.div>
            </LayoutGroup>
        </div>
    )
}
