import { cancelFrame, frame } from "framer-motion"
import {
    createElement,
    startTransition,
    useLayoutEffect,
    type TransitionStartFunction,
} from "react"

/**
 * Shared harness for the start-transition-* test pages.
 *
 * Pages drive a scripted timeline of real `.click()`s (so React assigns
 * discrete-event priority exactly as for user input), log every React commit,
 * and sample tracked elements' rendered boxes once per frame after Motion's
 * render step. Specs call `window.__analyze` to turn a sample series into
 * jump / late-start / missed-animation metrics.
 */

export type Mode = "sync" | "transition" | "useTransition" | "deferred"

export const params = new URLSearchParams(window.location.search)
export const mode = (params.get("mode") || "sync") as Mode
export const slowCount = Number(params.get("slowCount") ?? 12)
export const slowMs = Number(params.get("slowMs") ?? 5)

/**
 * Layout animation duration, in seconds. Long enough to sample ~35 frames,
 * short enough to keep the suite quick.
 */
export const duration = 0.6

export const linear = { type: "tween" as const, ease: "linear" as const }

interface Box {
    x: number
    y: number
    w: number
    h: number
    opacity: number
}

interface Sample {
    t: number
    boxes: Record<string, Box | null>
}

interface LogEvent {
    t: number
    type: string
    data?: unknown
}

declare global {
    interface Window {
        __events: LogEvent[]
        __samples: Sample[]
        __analyze: typeof analyze
        __done: boolean
    }
}

window.__events = []
window.__samples = []
window.__done = false

export const log = (type: string, data?: unknown) =>
    window.__events.push({ t: performance.now(), type, data })

export function busy(ms: number) {
    const end = performance.now() + ms
    let now = 0
    while (now < end) now = performance.now()
}

/**
 * Deliberately slow children. React yields between fibers every ~5ms in
 * concurrent renders, so many small slow components force a transition
 * render to span several tasks (and frames). `tick` makes them re-render.
 */
export function SlowList({ tick }: { tick: unknown }) {
    const children = []
    for (let i = 0; i < slowCount; i++) {
        children.push(createElement(Slow, { key: i }))
    }
    return createElement(
        "div",
        { style: { display: "none" }, "data-tick": String(tick) },
        children
    )
}

function Slow() {
    busy(slowMs)
    return null
}

/**
 * Wrap a state update according to the page's mode. Pages pass the
 * `startTransition` returned by `useTransition`, used only in that mode.
 */
export function update(fn: () => void, start?: TransitionStartFunction) {
    if (mode === "useTransition" && start) {
        start(fn)
    } else if (mode === "transition") {
        startTransition(fn)
    } else {
        fn()
    }
}

export function useCommitLog(label: string, value: unknown) {
    useLayoutEffect(() => {
        log("commit", { label, value })
    })
}

const tracked = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-track]"))

function sample() {
    const boxes: Record<string, Box | null> = {}
    for (const el of tracked()) {
        const name = el.dataset.track!
        if (!el.isConnected) {
            boxes[name] = null
            continue
        }
        const { left, top, width, height } = el.getBoundingClientRect()
        boxes[name] = {
            x: left,
            y: top,
            w: width,
            h: height,
            opacity: parseFloat(getComputedStyle(el).opacity),
        }
    }
    window.__samples.push({ t: performance.now(), boxes })
}

/**
 * Run a scripted timeline: each step is [delayFromStartMs, action].
 * Samples every frame from start until `tail` ms after the last step.
 */
export function runScript(steps: Array<[number, () => void]>, tail = 1200) {
    window.__events = []
    window.__samples = []
    window.__done = false
    const start = performance.now()
    log("start")
    frame.postRender(sample, true)
    for (const [delay, action] of steps) {
        setTimeout(action, delay)
    }
    const last = Math.max(...steps.map(([d]) => d))
    setTimeout(() => {
        cancelFrame(sample)
        log("done", { elapsed: performance.now() - start })
        window.__done = true
    }, last + tail)
}

export const click = (id: string) => () => {
    log("click", id)
    document.getElementById(id)!.click()
}

interface AnalyzeOptions {
    name: string
    axis?: "x" | "y" | "w" | "h" | "opacity"
    from: number
    to: number
    /** Only consider samples after this time (e.g. the triggering click). */
    after?: number
    /** Consecutive-frame delta, as a fraction of |to - from|, counted as a jump. */
    jumpFraction?: number
}

/**
 * Summarise the sampled path of one tracked element between `from` and `to`.
 */
function analyze({
    name,
    axis = "x",
    from,
    to,
    after = 0,
    jumpFraction = 0.25,
}: AnalyzeOptions) {
    const distance = Math.abs(to - from)
    const raw = window.__samples
        .filter((s) => s.t >= after)
        .map((s) => ({ t: s.t, v: s.boxes[name]?.[axis] ?? null }))
        .filter((s): s is { t: number; v: number } => s.v !== null)
    /**
     * `from`/`to` are offsets relative to the first sampled position, except
     * for opacity which is absolute.
     */
    const base = axis === "opacity" || !raw.length ? 0 : raw[0].v - from
    const series = raw.map((s) => ({ t: s.t, v: s.v - base }))

    const progressOf = (v: number) => (v - from) / (to - from)
    const tolerance = Math.min(0.5, distance * 0.01)
    const moved = series.findIndex((s) => Math.abs(s.v - from) > tolerance)
    const firstMove = moved === -1 ? null : series[moved]
    const reachedEnd = series.findIndex(
        (s) => Math.abs(s.v - to) < tolerance * 2
    )

    let maxDelta = 0
    let jumps = 0
    for (let i = 1; i < series.length; i++) {
        const delta = Math.abs(series[i].v - series[i - 1].v)
        maxDelta = Math.max(maxDelta, delta)
        if (delta > distance * jumpFraction) jumps++
    }

    const intermediate = series.filter((s) => {
        const p = progressOf(s.v)
        return p > 0.02 && p < 0.98
    }).length

    return {
        samples: series.length,
        firstMoveAt: firstMove?.t ?? null,
        firstMoveProgress: firstMove ? progressOf(firstMove.v) : null,
        reachedEndAt: reachedEnd === -1 ? null : series[reachedEnd].t,
        finalValue: series.length ? series[series.length - 1].v : null,
        finalProgress: series.length
            ? progressOf(series[series.length - 1].v)
            : null,
        intermediateFrames: intermediate,
        maxDeltaFraction: distance ? maxDelta / distance : 0,
        jumps,
    }
}

window.__analyze = analyze

export const commits = (label?: string) =>
    window.__events.filter(
        (e) =>
            e.type === "commit" &&
            (!label || (e.data as { label: string }).label === label)
    )
