import { motion } from "motion/react"
import { AnimateView } from "motion/react-animate-view"
import React, {
    Component,
    PropsWithChildren,
    startTransition,
    useState,
} from "react"

class Boundary extends Component<PropsWithChildren, { error: string }> {
    state = { error: "" }
    static getDerivedStateFromError(error: Error) {
        return { error: error.message }
    }
    render() {
        return this.state.error ? (
            <p id="error">{this.state.error}</p>
        ) : (
            this.props.children
        )
    }
}

export function App() {
    const [step, setStep] = useState(0)
    const mode = new URLSearchParams(location.search).get("mode") || "default"
    const supported = !!(React as any).ViewTransition
    const custom = mode === "custom"

    return (
        <>
            <div id="supported">{String(supported)}</div>
            <motion.div id="ordinary" animate={{ opacity: 0.5 }}>
                React {React.version}
            </motion.div>
            <button
                id="toggle"
                onClick={() => startTransition(() => setStep(step + 1))}
            >
                Toggle
            </button>
            <pre id="events" />
            <Boundary>
                {((supported && (mode === "share" || mode === "update")) ||
                    step % 2 === 1) && (
                    <AnimateView
                        key={mode === "update" ? "update" : step}
                        name={mode === "share" ? "shared" : undefined}
                        transition={{ duration: 0.4, ease: "linear" }}
                        enter={custom ? { opacity: [0, 1] } : undefined}
                        exit={custom ? { opacity: [1, 0] } : undefined}
                        onAnimationStart={(animation, type) => {
                            const output = document.getElementById("events")!
                            const animations = (animation as any).animations
                            output.dataset[type] = JSON.stringify({
                                duration: animation.duration,
                                count: animations.length,
                            })
                        }}
                        onAnimationComplete={(type) => {
                            document.getElementById("events")!.dataset[
                                `${type}Complete`
                            ] = "true"
                        }}
                    >
                        <div
                            id="view"
                            style={{
                                width: 100 + step * 20,
                                height: 100,
                                background: step % 2 ? "red" : "blue",
                            }}
                        >
                            View {step}
                        </div>
                    </AnimateView>
                )}
            </Boundary>
        </>
    )
}
