"use client"
import { LayoutGroup, motion } from "motion/react"
import { useState } from "react"

function NavigationItem({
    title,
    current,
    onClick,
    id,
    layoutCurveAmplitude,
}: {
    title: string
    current?: boolean
    onClick?: () => void
    id: string
    layoutCurveAmplitude?: number
}) {
    return (
        <div
            style={{
                position: "relative",
                padding: 10,
            }}
        >
            {current && (
                <motion.span
                    id="current-indicator"
                    layoutId="current-indicator"
                    layoutCurve={{
                        amplitude: layoutCurveAmplitude,
                    }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    style={{
                        zIndex: -1,
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "#DECADE",
                    }}
                />
            )}
            <button
                id={id}
                style={{
                    position: "relative",
                    padding: "1rem",
                    width: "100%",
                }}
                onClick={onClick}
            >
                {title}
            </button>
        </div>
    )
}

export default function Page() {
    const [state, setState] = useState("a")
    const [layoutCurveAmplitude, setCurveAmplitude] = useState(1)

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
                    <code>layoutCurveAmplitude: {layoutCurveAmplitude}</code>
                </label>
                <input
                    type="range"
                    min={-1}
                    step={0.1}
                    max={1}
                    value={layoutCurveAmplitude}
                    onChange={(e) => setCurveAmplitude(Number(e.target.value))}
                />
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
                            current={state === "a"}
                            onClick={() => setState("a")}
                            layoutCurveAmplitude={layoutCurveAmplitude}
                        />

                        <NavigationItem
                            id="b"
                            title="Secondary Location"
                            current={state === "b"}
                            onClick={() => setState("b")}
                            layoutCurveAmplitude={layoutCurveAmplitude}
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
                            current={state === "a"}
                            onClick={() => setState("a")}
                            layoutCurveAmplitude={layoutCurveAmplitude}
                        />

                        <NavigationItem
                            id="bb"
                            title="Secondary Location"
                            current={state === "b"}
                            onClick={() => setState("b")}
                            layoutCurveAmplitude={layoutCurveAmplitude}
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
                                current={state === "a"}
                                onClick={() => setState("a")}
                                layoutCurveAmplitude={layoutCurveAmplitude}
                            />
                        </div>

                        <NavigationItem
                            id="bc"
                            title="Secondary Location"
                            current={state === "b"}
                            onClick={() => setState("b")}
                            layoutCurveAmplitude={layoutCurveAmplitude}
                        />
                    </LayoutGroup>
                </div>
            </div>
        </div>
    )
}
