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
                    layoutArc={arc}
                    transition={{
                        duration: 1,
                        ease: "linear",
                    }}
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
    const [layoutArc, setLayoutArc] = useState<Arc>({ amplitude: 1 })

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
                    >{`<motion.span
    layoutId="indicator"
    layoutArc={{
        amplitude: ${layoutArc.amplitude},${
            layoutArc.peak !== undefined
                ? `\n        peak: ${layoutArc.peak},`
                : ""
        }${
            layoutArc.direction !== undefined
                ? `\n        direction: ${typeof layoutArc.direction === "string" ? `"${layoutArc.direction}"` : layoutArc.direction},`
                : ""
        }
    }}
/>`}</code>
                </label>
                <label style={{ marginTop: 12 }}>amplitude</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={2}
                    value={layoutArc.amplitude}
                    onChange={(e) =>
                        setLayoutArc({
                            ...layoutArc,
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
                    value={layoutArc.peak ?? 0.5}
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
                        const direction: Arc["direction"] =
                            val === "auto"
                                ? undefined
                                : val === "1" || val === "-1"
                                  ? (Number(val) as 1 | -1)
                                  : (val as "up" | "down" | "left" | "right")
                        setLayoutArc({ ...layoutArc, direction })
                    }}
                >
                    <option value="auto">auto</option>
                    <option value="1">1 (relative)</option>
                    <option value="-1">-1 (relative)</option>
                    <option value="up">up</option>
                    <option value="down">down</option>
                    <option value="left">left</option>
                    <option value="right">right</option>
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
                    <LayoutGroup id="nav-horizontal">
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
                    <LayoutGroup id="nav-vertical">
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
                    <LayoutGroup id="nav-diagonal">
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
