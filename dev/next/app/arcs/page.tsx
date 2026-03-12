"use client"
import { Arc, LayoutGroup, motion, useAnimate } from "motion/react"
import { useEffect, useState } from "react"

export default function Page() {
    const [arc, setArc] = useState<Arc>({ amplitude: 1 })

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "320px 1fr",
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
                    gap: 8,
                }}
            >
                <code
                    style={{
                        display: "block",
                        whiteSpace: "pre",
                        backgroundColor: "#0000000a",
                        padding: 12,
                        borderRadius: 4,
                        fontSize: 12,
                    }}
                >{`arc: {
    amplitude: ${arc.amplitude},${
                    arc.peak !== undefined ? `\n    peak: ${arc.peak},` : ""
                }${
                    arc.direction !== undefined
                        ? `\n    direction: "${arc.direction}",`
                        : ""
                }
}`}</code>
                <label>amplitude</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={2}
                    value={arc.amplitude}
                    onChange={(e) =>
                        setArc({ ...arc, amplitude: Number(e.target.value) })
                    }
                />
                <label>peak (default 0.5)</label>
                <input
                    type="range"
                    min={0}
                    step={0.1}
                    max={1}
                    value={arc.peak ?? 0.5}
                    onChange={(e) =>
                        setArc({ ...arc, peak: Number(e.target.value) })
                    }
                />
                <label>direction</label>
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
            </div>
            <div style={{ overflowY: "auto" }}>
                <Examples arc={arc} />
            </div>
        </div>
    )
}

const Section = ({
    title,
    children,
}: {
    title: string
    children: React.ReactNode
}) => (
    <div style={{ borderBottom: "solid 1px #00000020", padding: "2rem" }}>
        <div
            style={{
                fontFamily: "sans-serif",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#00000060",
                marginBottom: "1.5rem",
            }}
        >
            {title}
        </div>
        {children}
    </div>
)

const Examples = ({ arc }: { arc: Arc }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <Section title="useAnimate">
                <UseAnimateExample arc={arc} />
            </Section>

            <Section title="animate — x">
                <MotionExample
                    animate={{ x: [-200, 200] }}
                    baseTransition={{ duration: 1, ease: "easeInOut" }}
                    arc={arc}
                />
            </Section>

            <Section title="animate — y">
                <MotionExample
                    animate={{ y: [-100, 100] }}
                    baseTransition={{ duration: 1, ease: "easeInOut" }}
                    arc={arc}
                />
            </Section>

            <Section title="animate — x + y">
                <MotionExample
                    animate={{ x: [-200, 200], y: [-100, 100] }}
                    baseTransition={{ duration: 1, ease: "easeInOut" }}
                    arc={arc}
                />
            </Section>

            <Section title="animate — x + y + scale">
                <MotionExample
                    animate={{
                        x: [-200, 200],
                        y: [-100, 100],
                        scale: [1, 1.5],
                    }}
                    baseTransition={{ duration: 1, ease: "easeInOut" }}
                    arc={arc}
                />
            </Section>

            <Section title="layoutId — horizontal">
                <LayoutExample
                    id="nav-horizontal"
                    arc={arc}
                    layout="horizontal"
                />
            </Section>

            <Section title="layoutId — vertical">
                <LayoutExample id="nav-vertical" arc={arc} layout="vertical" />
            </Section>

            <Section title="layoutId — diagonal">
                <LayoutExample id="nav-diagonal" arc={arc} layout="diagonal" />
            </Section>
        </div>
    )
}

function LayoutExample({
    id,
    arc,
    layout,
}: {
    id: string
    arc: Arc
    layout: "horizontal" | "vertical" | "diagonal"
}) {
    const [active, setActive] = useState("a")

    const containerStyle =
        layout === "horizontal"
            ? { display: "flex", gap: 8 }
            : layout === "vertical"
            ? {
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 8,
                  alignItems: "flex-start" as const,
              }
            : {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  maxWidth: 400,
              }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LayoutGroup id={id}>
                <div style={containerStyle}>
                    <NavigationItem
                        id={`${id}-a`}
                        title="Primary"
                        isActive={active === "a"}
                        arc={arc}
                    />
                    {layout === "diagonal" && <div />}
                    {layout === "diagonal" && <div />}
                    <NavigationItem
                        id={`${id}-b`}
                        title="Secondary"
                        isActive={active === "b"}
                        arc={arc}
                    />
                </div>
            </LayoutGroup>
            <button onClick={() => setActive((s) => (s === "a" ? "b" : "a"))}>
                Toggle
            </button>
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
                    padding: "0.5rem 1rem",
                }}
            >
                {title}
            </div>
        </div>
    )
}

function UseAnimateExample({ arc }: { arc: Arc }) {
    const [scope, animate] = useAnimate()
    const [toggled, setToggled] = useState(false)

    useEffect(() => {
        animate(
            scope.current,
            { x: toggled ? 168 : 0, y: toggled ? 168 : 0 },
            { duration: 1, ease: "easeInOut", arc }
        )
    }, [toggled, arc, animate, scope])

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 16,
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: 200,
                    height: 200,
                    border: "1px dashed #00000020",
                    borderRadius: 8,
                }}
            >
                <div
                    ref={scope}
                    style={{
                        position: "absolute",
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: "#a9c1ff",
                    }}
                />
            </div>
            <button onClick={() => setToggled((t) => !t)}>Toggle</button>
        </div>
    )
}

const MotionExample = ({
    animate,
    baseTransition,
    arc,
}: {
    animate: { x?: number[]; y?: number[]; scale?: number[] }
    baseTransition: { duration: number; ease: "easeInOut" }
    arc: Arc
}) => {
    return (
        <div
            key={JSON.stringify(arc)}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 16,
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: 200,
                    border: "1px dashed #00000020",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <motion.div
                    animate={animate}
                    transition={{
                        ...baseTransition,
                        repeat: Infinity,
                        repeatType: "mirror",
                    }}
                    style={{
                        position: "absolute",
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        border: "1px dashed #00000060",
                    }}
                />
                <motion.div
                    animate={animate}
                    transition={{
                        ...baseTransition,
                        repeat: Infinity,
                        repeatType: "mirror",
                        arc,
                    }}
                    style={{
                        position: "absolute",
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: "#a9c1ff",
                    }}
                />
            </div>
        </div>
    )
}
