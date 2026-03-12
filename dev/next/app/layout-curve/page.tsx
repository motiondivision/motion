"use client"
import {
    Arc,
    LayoutGroup,
    motion,
    TargetAndTransition,
    Transition,
} from "motion/react"
import { useState } from "react"

export default function Page() {
    const [state, setState] = useState("a")
    const [arc, setArc] = useState<Arc>({ amplitude: 1 })

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "320px 1fr",
                justifyContent: "center",
                alignItems: "center",
                height: "100svh",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    background: "#ffffffcc",
                    borderRight: "solid 1px #00000020",
                    padding: 24,
                }}
            >
                <code
                    style={{
                        display: "block",
                        whiteSpace: "pre",
                        backgroundColor: "#0000000a",
                        padding: 12,
                        borderRadius: 4,
                    }}
                >{`<motion.span
    layoutId="indicator"
    transition={{
        layout: {
            arc: {
                amplitude: ${arc.amplitude},${
                    arc.peak !== undefined
                        ? `\n                peak: ${arc.peak},`
                        : ""
                }${
                    arc.direction !== undefined
                        ? `\n                direction: "${arc.direction}",`
                        : ""
                }
            },
        },
    }}
/>`}</code>
                <label style={{ marginTop: 12 }}>amplitude</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={2}
                    value={arc.amplitude}
                    onChange={(e) =>
                        setArc({
                            ...arc,
                            amplitude: Number(e.target.value),
                        })
                    }
                />
                <label style={{ marginTop: 8 }}>peak (default 0.5)</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={1}
                    value={arc.peak ?? 0.5}
                    onChange={(e) =>
                        setArc({
                            ...arc,
                            peak: Number(e.target.value),
                        })
                    }
                />
                <label style={{ marginTop: 8 }}>direction</label>
                <select
                    value={arc.direction ?? "auto"}
                    onChange={(e) => {
                        const val = e.target.value
                        const direction: Arc["direction"] =
                            val === "auto" ? undefined : (val as "cw" | "ccw")
                        setArc({ ...arc, direction })
                    }}
                >
                    <option value="auto">auto</option>
                    <option value="cw">cw</option>
                    <option value="ccw">ccw</option>
                </select>
                <button
                    style={{ marginTop: 12 }}
                    onClick={() => setState(state === "a" ? "b" : "a")}
                >
                    Toggle
                </button>
            </div>
            <div>
                <Examples state={state} arc={arc} />
            </div>
        </div>
    )
}

const Example = ({
    children,
    variant,
}: {
    children: React.ReactNode
    variant?: string
}) => {
    return (
        <div
            style={{
                display: "grid",
                alignItems: "center",
                justifyItems: "center",
                borderBottom: "solid 1px #00000020",
                width: "100%",
                height: "100%",
                padding: "2rem",
                ...(variant === "horizontal" && {
                    gridTemplateColumns: "1fr 1fr",
                }),
                ...(variant === "vertical" && {
                    gridTemplateRows: "1fr 1fr",
                }),
                ...(variant === "diagonal" && {
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "1fr 1fr",
                }),
            }}
        >
            {children}
        </div>
    )
}

const Examples = ({ state, arc }: { state: string; arc: Arc }) => {
    return (
        <div
            style={{ display: "flex", flexDirection: "column", gap: "8rem" }}
            key={state}
        >
            <Example variant="diagonal">
                <MotionExample
                    animate={{ x: [0, 168] }}
                    transition={{
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 1,
                        ease: "easeInOut",
                    }}
                    arc={arc}
                />
                <MotionExample
                    animate={{ y: [0, 168] }}
                    transition={{
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 1,
                        ease: "easeInOut",
                    }}
                    arc={arc}
                />
                <MotionExample
                    animate={{ x: [0, 168], y: [0, 168] }}
                    transition={{
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 1,
                        ease: "easeInOut",
                    }}
                    arc={arc}
                />
                <MotionExample
                    animate={{ x: [0, 168], y: [0, 168], scale: [1, 2, 1] }}
                    transition={{
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 1,
                        ease: "easeInOut",
                    }}
                    arc={arc}
                />
            </Example>
            <Example variant="horizontal">
                <LayoutGroup id="nav-horizontal">
                    <NavigationItem
                        id="a"
                        title="Primary Location"
                        isActive={state === "a"}
                        arc={arc}
                    />

                    <NavigationItem
                        id="b"
                        title="Secondary Location"
                        isActive={state === "b"}
                        arc={arc}
                    />
                </LayoutGroup>
            </Example>
            <Example variant="vertical">
                <LayoutGroup id="nav-vertical">
                    <NavigationItem
                        id="a2"
                        title="Primary Location"
                        isActive={state === "a"}
                        arc={arc}
                    />

                    <NavigationItem
                        id="b2"
                        title="Secondary Location"
                        isActive={state === "b"}
                        arc={arc}
                    />
                </LayoutGroup>
            </Example>
            <Example variant="diagonal">
                <LayoutGroup id="nav-diagonal">
                    <NavigationItem
                        id="a3"
                        title="Primary Location"
                        isActive={state === "a"}
                        arc={arc}
                    />
                    <div />
                    <div />
                    <NavigationItem
                        id="b3"
                        title="Secondary Location"
                        isActive={state === "b"}
                        arc={arc}
                    />
                </LayoutGroup>
            </Example>
        </div>
    )
}

function NavigationItem({
    title,
    id,
    arc,
    isActive,
}: {
    title: string
    id: string
    arc: Arc
    isActive?: boolean
}) {
    return (
        <div
            style={{
                position: "relative",
                padding: 10,
                boxShadow: "0 0 0 1px #00000020",
                borderRadius: 8,
            }}
        >
            {isActive && (
                <motion.span
                    id="current-indicator"
                    layoutId="current-indicator"
                    transition={{
                        layout: { arc, duration: 1, ease: "easeInOut" },
                    }}
                    style={{
                        zIndex: -1,
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "#a9c1ff",
                        borderRadius: "inherit",
                    }}
                />
            )}
            <div
                id={id}
                style={{
                    position: "relative",
                    padding: "1rem",
                    width: "100%",
                }}
            >
                {title}
            </div>
        </div>
    )
}

const MotionExample = ({
    animate,
    transition,
    arc,
}: {
    animate: TargetAndTransition
    transition: Transition
    arc: Arc
}) => {
    return (
        <div
            style={{
                position: "relative",
                width: 200,
                height: 200,
                border: "1px dashed #00000020",
                borderRadius: 8,
            }}
        >
            <motion.div
                animate={animate}
                transition={transition}
                style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    border: "1px dashed #00000020",
                }}
            />
            <motion.div
                animate={animate}
                transition={{ ...transition, arc }}
                style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: "#a9c1ff",
                }}
            />
        </div>
    )
}
