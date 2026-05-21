import { arc, LayoutGroup, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"

const ITEM_A = { left: 50, top: 200, width: 100, height: 50 }
const ITEM_B = { left: 450, top: 200, width: 100, height: 50 }
const ITEM_B_NEAR = { left: 60, top: 200, width: 100, height: 50 }

/**
 * URL variants:
 *   default       — auto-toggling layout arc, real ease (visual demo)
 *   freeze        — ease() => 0.5 to pin layout animation at midpoint (Cypress)
 *   none          — like freeze but no `path` (linear baseline)
 *   small         — sub-threshold distance, falls back to linear
 *   keyframe      — keyframe arc with a Toggle button
 *   oriented      — keyframe arc with rotate: true
 *   freezeAt=N    — pin keyframe animation at fraction N (0..1)
 *   interrupt     — auto-toggle layout fast, mid-flight (continuity demo)
 *   axis-change   — interrupt across a dominant-axis change (continuity demo)
 *   cw            — direction locked clockwise
 *   ccw           — direction locked counter-clockwise
 *   ping-pong     — keyframe arc bouncing between three points
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const variant = params.get("variant") || "default"

    if (variant === "keyframe" || variant === "oriented") {
        return <KeyframeArc oriented={variant === "oriented"} />
    }

    if (variant === "ping-pong") return <PingPong />
    if (variant === "axis-change") return <AxisChange />
    if (variant === "rotate-compose") return <RotateCompose />

    return <LayoutArc variant={variant} />
}

const LayoutArc = ({ variant }: { variant: string }) => {
    const isSmall = variant === "small"
    const itemB = isSmall ? ITEM_B_NEAR : ITEM_B
    const isFreeze = variant === "freeze" || variant === "none" || isSmall
    const direction = variant === "cw" ? "cw" : variant === "ccw" ? "ccw" : undefined
    const ease = isFreeze ? () => 0.5 : undefined
    const duration = isFreeze ? 4 : 1.2

    // Memoize the arc factory so its closure (prevBulgeSign) survives renders.
    const path = useMemo(
        () => (variant === "none" ? undefined : arc({ amp: 1, direction })),
        [variant, direction]
    )

    const transition: any = { duration, ...(ease ? { ease } : {}) }
    if (path) transition.path = path

    const [active, setActive] = useState<"a" | "b">("a")

    useEffect(() => {
        if (isFreeze) return
        const interval = variant === "interrupt" ? 600 : 1500
        const id = window.setInterval(() => {
            setActive((prev) => (prev === "a" ? "b" : "a"))
        }, interval)
        return () => window.clearInterval(id)
    }, [isFreeze, variant])

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <Hud variant={variant} />
            <button
                id="toggle"
                onClick={() => setActive(active === "a" ? "b" : "a")}
                style={{ position: "fixed", top: 16, left: 16 }}
            >
                Toggle
            </button>
            <LayoutGroup id="arc-test">
                <div id="item-a" style={{ position: "absolute", ...ITEM_A }}>
                    {active === "a" && (
                        <motion.div
                            id="indicator"
                            layoutId="indicator"
                            transition={transition}
                            style={{ width: 100, height: 100, background: "red" }}
                        />
                    )}
                </div>
                <div id="item-b" style={{ position: "absolute", ...itemB }}>
                    {active === "b" && (
                        <motion.div
                            id="indicator"
                            layoutId="indicator"
                            transition={transition}
                            style={{ width: 100, height: 100, background: "red" }}
                        />
                    )}
                </div>
            </LayoutGroup>
        </div>
    )
}

const KeyframeArc = ({ oriented }: { oriented: boolean }) => {
    const [target, setTarget] = useState<"a" | "b">("a")
    const params = new URLSearchParams(window.location.search)
    const freezeAt = params.has("freezeAt")
        ? Number(params.get("freezeAt"))
        : params.has("freeze")
        ? 0.5
        : undefined
    const path = useRef(arc({ amp: 1, rotate: oriented })).current

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <Hud variant={oriented ? "oriented" : "keyframe"} />
            <button
                id="toggle"
                onClick={() => setTarget((p) => (p === "a" ? "b" : "a"))}
                style={{ position: "fixed", top: 16, left: 16 }}
            >
                Toggle
            </button>
            <motion.div
                id="indicator"
                animate={{ x: target === "a" ? 0 : 400, y: 0 }}
                transition={{
                    duration: freezeAt !== undefined ? 4 : 1.2,
                    ...(freezeAt !== undefined ? { ease: () => freezeAt } : {}),
                    path,
                }}
                style={{
                    position: "absolute",
                    top: 200,
                    left: 50,
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
        </div>
    )
}

/**
 * Bounces between three corners of a triangle. With a memoized arc(),
 * the closure should keep the bulge on a consistent screen side as the
 * dominant axis swings between segments.
 */
const PingPong = () => {
    const positions = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 200, y: 300 },
    ]
    const [i, setI] = useState(0)
    const path = useRef(arc({ amp: 0.7, rotate: 0.5 })).current

    useEffect(() => {
        const id = window.setInterval(() => {
            setI((p) => (p + 1) % positions.length)
        }, 1400)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <Hud variant="ping-pong" />
            <motion.div
                id="indicator"
                animate={positions[i]}
                transition={{ duration: 1.2, path }}
                style={{
                    position: "absolute",
                    top: 100,
                    left: 100,
                    width: 80,
                    height: 80,
                    background: "tomato",
                }}
            />
        </div>
    )
}

/**
 * Demonstrates the dominant-axis-change continuity case. Auto-direction
 * alone would pick a different screen side when the chord swings from
 * mostly-horizontal to mostly-vertical. With a reused arc(), the bulge
 * stays consistent.
 */
const AxisChange = () => {
    const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)
    const path = useRef(arc({ amp: 0.7 })).current
    const points = [
        { x: 0, y: 0 },
        { x: 300, y: 50 },
        { x: 350, y: 350 },
        { x: 0, y: 300 },
    ]

    useEffect(() => {
        const id = window.setInterval(() => {
            setPhase((p) => ((p + 1) % 4) as 0 | 1 | 2 | 3)
        }, 1300)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <Hud variant="axis-change" />
            <motion.div
                id="indicator"
                animate={points[phase]}
                transition={{ duration: 1.1, path }}
                style={{
                    position: "absolute",
                    top: 100,
                    left: 100,
                    width: 60,
                    height: 60,
                    background: "tomato",
                }}
            />
        </div>
    )
}

/**
 * An oriented arc running *at the same time* as a user `rotate`
 * animation. Frozen at t=0.5: pathRotation is ~0 by symmetry there, so
 * the only rotation in the matrix should be the user's `rotate` at 50%
 * (0 → 90 → 45deg). If the arc clobbered `rotate` (the old behaviour)
 * the element would read ~0deg instead. Proves composition + that the
 * user's value is never overwritten.
 */
const RotateCompose = () => {
    const [target, setTarget] = useState<"a" | "b">("a")
    const path = useRef(arc({ amp: 1, rotate: true })).current

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <Hud variant="rotate-compose" />
            <button
                id="toggle"
                onClick={() => setTarget((p) => (p === "a" ? "b" : "a"))}
                style={{ position: "fixed", top: 16, left: 16 }}
            >
                Toggle
            </button>
            <motion.div
                id="indicator"
                animate={{
                    x: target === "a" ? 0 : 400,
                    y: 0,
                    rotate: target === "a" ? 0 : 90,
                }}
                transition={{ duration: 4, ease: () => 0.5, path }}
                style={{
                    position: "absolute",
                    top: 200,
                    left: 50,
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
        </div>
    )
}

const Hud = ({ variant }: { variant: string }) => (
    <div
        style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            padding: "6px 10px",
            background: "#111",
            color: "#fff",
            font: "12px/1.4 ui-monospace, monospace",
            borderRadius: 4,
            opacity: 0.85,
        }}
    >
        variant=<b>{variant}</b>
    </div>
)
