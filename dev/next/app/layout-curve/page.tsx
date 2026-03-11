"use client"
import { Arc, LayoutGroup, motion } from "motion/react"
import { useState } from "react"

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
            }}
        >
            {isActive && (
                <motion.span
                    id="current-indicator"
                    layoutId="current-indicator"
                    layoutArc={{
                        amplitude: arc.amplitude,
                        peak: arc.peak,
                        direction: arc.direction,
                    }}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{
                        zIndex: -1,
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "#DECADE",
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

export default function Page() {
    const [state, setState] = useState("a")
    const [layoutArc, setLayoutArc] = useState<Arc>({ amplitude: 1, peak: 0.5 })

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100svh",
            }}
        >
            <div
                style={{
                    position: "fixed",
                    top: 24,
                    left: 24,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <label>
                    <code
                        style={{
                            display: "block",
                            minWidth: 340,
                            whiteSpace: "pre",
                            backgroundColor: "#00000020",
                            padding: 24,
                            borderRadius: 4,
                        }}
                    >{`<motion.div
    layout="position"
    layoutArc={{
        amplitude: ${layoutArc.amplitude},
        peak: ${layoutArc.peak},${
                        layoutArc.direction
                            ? `\n        direction: ${layoutArc.direction},`
                            : ""
                    }
    }}
/>`}</code>
                </label>
                <label style={{ marginTop: 12 }}>amplitude</label>
                <input
                    type="range"
                    min={-1}
                    step={0.1}
                    max={1}
                    value={layoutArc.amplitude}
                    onChange={(e) =>
                        setLayoutArc({
                            ...layoutArc,
                            amplitude: Number(e.target.value),
                        })
                    }
                />
                <label style={{ marginTop: 8 }}>peak</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={1}
                    value={layoutArc.peak}
                    onChange={(e) =>
                        setLayoutArc({
                            ...layoutArc,
                            peak: Number(e.target.value),
                        })
                    }
                />
                <label style={{ marginTop: 8 }}>direction</label>
                <select
                    value={layoutArc.direction ?? "auto"}
                    onChange={(e) => {
                        const val = e.target.value
                        setLayoutArc({
                            ...layoutArc,
                            direction:
                                val === "auto"
                                    ? undefined
                                    : (Number(val) as 1 | -1),
                        })
                    }}
                >
                    <option value="auto">auto</option>
                    <option value="1">1</option>
                    <option value="-1">-1</option>
                </select>
                <button
                    style={{ marginTop: 12 }}
                    onClick={() => setState(state === "a" ? "b" : "a")}
                >
                    Toggle
                </button>
            </div>
            <div
                style={{
                    maxWidth: "64rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "18rem",
                        padding: "8rem",
                    }}
                >
                    <LayoutGroup id={state}>
                        <NavigationItem
                            id="a"
                            title="Primary Location"
                            isActive={state === "a"}
                            arc={layoutArc}
                        />

                        <NavigationItem
                            id="b"
                            title="Secondary Location"
                            isActive={state === "b"}
                            arc={layoutArc}
                        />
                    </LayoutGroup>
                </div>
            </div>
            <div
                style={{
                    maxWidth: "64rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8rem",
                        padding: "8rem",
                    }}
                >
                    <LayoutGroup id={`${state}b`}>
                        <NavigationItem
                            id="ab"
                            title="Primary Location"
                            isActive={state === "a"}
                            arc={layoutArc}
                        />

                        <NavigationItem
                            id="bb"
                            title="Secondary Location"
                            isActive={state === "b"}
                            arc={layoutArc}
                        />
                    </LayoutGroup>
                </div>
            </div>
            <div
                style={{
                    maxWidth: "64rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8rem",
                        padding: "8rem",
                    }}
                >
                    <LayoutGroup id={`${state}c`}>
                        <div style={{ paddingRight: "25rem" }}>
                            <NavigationItem
                                id="ac"
                                title="Primary Location"
                                isActive={state === "a"}
                                arc={layoutArc}
                            />
                        </div>

                        <NavigationItem
                            id="bc"
                            title="Secondary Location"
                            isActive={state === "b"}
                            arc={layoutArc}
                        />
                    </LayoutGroup>
                </div>
            </div>
        </div>
    )
}
