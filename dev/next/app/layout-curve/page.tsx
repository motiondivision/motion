"use client"
import { cancelFrame, frame, LayoutGroup, motion } from "motion/react"
import { useEffect, useState } from "react"

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
    const [layoutCurveAmplitude, setCurveAmplitude] = useState(500)

    useEffect(() => {
        let prevLeft = 0
        const check = frame.setup(() => {
            const indicator = document.getElementById("current-indicator")
            if (!indicator) return

            const { left } = indicator.getBoundingClientRect()

            if (Math.abs(left - prevLeft) > 100) {
                // console.log(prevLeft, left)
            }

            prevLeft = left
        }, true)

        return () => cancelFrame(check)
    }, [state])

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
                    min={-1000}
                    max={1000}
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
        </div>
    )
}
