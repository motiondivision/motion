import { arc, motion } from "framer-motion"
import { useMemo, useState } from "react"

const DIRECTIONS = ["auto", "cw", "ccw"] as const
type Direction = (typeof DIRECTIONS)[number]

/**
 * Spring-driven variant of the arc playground. The path animator hands
 * its progress value off to whatever transition the user supplies, so a
 * spring with high `bounce` overshoots `t=1` and oscillates back — the
 * arc samples past its endpoint during the overshoot, giving the curve
 * a bouncy settle.
 *
 * URL: `?example=transition-arc-spring-playground`
 */
export const App = () => {
    const [strength, setStrength] = useState(1)
    const [peak, setPeak] = useState(0.5)
    const [rotateScale, setRotateScale] = useState(1)
    const [direction, setDirection] = useState<Direction>("auto")
    const [bounce, setBounce] = useState(0.6)
    const [visualDuration, setVisualDuration] = useState(0.6)
    const [target, setTarget] = useState<"a" | "b">("a")

    const path = useMemo(
        () =>
            arc({
                strength,
                peak,
                direction: direction === "auto" ? undefined : direction,
                rotate: rotateScale,
            }),
        [strength, peak, direction, rotateScale]
    )

    const A = { x: 0, y: 0 }
    const B = { x: 400, y: 0 }
    const pos = target === "a" ? A : B

    const code = `arc({
  strength: ${strength.toFixed(2)},
  peak: ${peak.toFixed(2)},
  direction: ${direction === "auto" ? "undefined" : `"${direction}"`},
  rotate: ${rotateScale === 0 ? "false" : rotateScale.toFixed(2)},
})

// transition
{
  type: "spring",
  bounce: ${bounce.toFixed(2)},
  visualDuration: ${visualDuration.toFixed(2)},
  path,
}`

    return (
        <div style={containerStyle}>
            <div style={stageStyle}>
                <Marker label="A" x={100} y={300} />
                <Marker label="B" x={500} y={300} />
                <motion.div
                    animate={pos}
                    transition={{
                        type: "spring",
                        bounce,
                        visualDuration,
                        path,
                    }}
                    style={{
                        position: "absolute",
                        top: 280,
                        left: 80,
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "tomato",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                />
                <button
                    onClick={() => setTarget((t) => (t === "a" ? "b" : "a"))}
                    style={toggleBtn}
                >
                    Toggle → {target === "a" ? "B" : "A"}
                </button>
            </div>

            <div style={panelStyle}>
                <h3 style={{ margin: 0, font: "600 14px ui-sans-serif" }}>
                    arc() + spring
                </h3>

                <Slider
                    label="bounce"
                    value={bounce}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={setBounce}
                    help="0 = no bounce, 1 = extremely bouncy"
                />

                <Slider
                    label="visualDuration (s)"
                    value={visualDuration}
                    min={0.1}
                    max={3}
                    step={0.05}
                    onChange={setVisualDuration}
                    help="visual time to reach target; bounce settles after"
                />

                <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "16px 0" }} />

                <Slider
                    label="strength"
                    value={strength}
                    min={0}
                    max={1.5}
                    step={0.05}
                    onChange={setStrength}
                    help="bulge perpendicular to chord, as fraction of distance"
                />

                <Slider
                    label="peak"
                    value={peak}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={setPeak}
                    help="where along the chord (0–1) the arc reaches max height"
                />

                <Radio
                    label="direction"
                    value={direction}
                    options={DIRECTIONS}
                    onChange={setDirection}
                />

                <Slider
                    label="rotate"
                    value={rotateScale}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={setRotateScale}
                    help="0 = off; otherwise multiplier on tangent-vs-baseline"
                />

                <pre style={codeStyle}>{code}</pre>
            </div>
        </div>
    )
}

const Marker = ({ label, x, y }: { label: string; x: number; y: number }) => (
    <div
        style={{
            position: "absolute",
            left: x - 12,
            top: y - 12,
            width: 24,
            height: 24,
            borderRadius: 12,
            border: "2px dashed #999",
            color: "#666",
            font: "600 12px ui-sans-serif",
            display: "grid",
            placeItems: "center",
        }}
    >
        {label}
    </div>
)

const Slider = ({
    label,
    value,
    min,
    max,
    step,
    onChange,
    help,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (v: number) => void
    help?: string
}) => (
    <label style={{ display: "block", marginBottom: 12 }}>
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                font: "500 13px ui-sans-serif",
            }}
        >
            <span>{label}</span>
            <span style={{ color: "#666" }}>{value.toFixed(2)}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{ width: "100%" }}
        />
        {help && (
            <div style={{ font: "11px ui-sans-serif", color: "#888" }}>
                {help}
            </div>
        )}
    </label>
)

const Radio = <T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: readonly T[]
    onChange: (v: T) => void
}) => (
    <div style={{ marginBottom: 12 }}>
        <div style={{ font: "500 13px ui-sans-serif", marginBottom: 4 }}>
            {label}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
            {options.map((opt) => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        background: opt === value ? "#222" : "#fff",
                        color: opt === value ? "#fff" : "#222",
                        font: "500 12px ui-sans-serif",
                        cursor: "pointer",
                    }}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
)

const containerStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 300px",
    height: "100vh",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
}

const stageStyle: React.CSSProperties = {
    position: "relative",
    background: "#fafafa",
    borderRight: "1px solid #eee",
    overflow: "hidden",
}

const panelStyle: React.CSSProperties = {
    padding: 20,
    overflowY: "auto",
}

const toggleBtn: React.CSSProperties = {
    position: "absolute",
    top: 16,
    left: 16,
    padding: "8px 14px",
    borderRadius: 4,
    border: "1px solid #ccc",
    background: "#fff",
    font: "500 13px ui-sans-serif",
    cursor: "pointer",
}

const codeStyle: React.CSSProperties = {
    marginTop: 20,
    padding: 12,
    background: "#111",
    color: "#9ee9b8",
    borderRadius: 4,
    font: "12px/1.5 ui-monospace, monospace",
    whiteSpace: "pre",
}
