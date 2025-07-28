"use client"
import { cancelFrame, frame, LayoutGroup, motion } from "motion/react"
import { useEffect, useState } from "react"

function NavigationItem({
    title,
    current,
    onClick,
    id,
}: {
    title: string
    current?: boolean
    onClick?: () => void
    id: string
}) {
    return (
        <div
            style={{
                position: "relative",
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {current && (
                <motion.span
                    id="current-indicator"
                    layoutId="current-indicator"
                    transition={{ duration: 2 }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "#0ea5e9", // sky-500
                    }}
                />
            )}
            <button
                id={id}
                style={{
                    position: "relative",
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
        <nav
            style={{
                height: "3.5rem", // h-14
                width: "400px",
                backgroundColor: "#e2e8f0", // slate-200
                maxWidth: "20rem", // max-w-xs
                paddingLeft: "1rem", // px-4
                paddingRight: "1rem",
                paddingTop: "0.5rem", // py-2
                paddingBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem", // gap-x-3
            }}
        >
            <LayoutGroup id={state}>
                <NavigationItem
                    id="a"
                    title="Home"
                    current={state === "a"}
                    onClick={() => setState("a")}
                />
                <NavigationItem
                    id="b"
                    title="Account"
                    current={state === "b"}
                    onClick={() => setState("b")}
                />
            </LayoutGroup>
        </nav>
    )
}
