import { motion, useMotionValue } from "framer-motion"
import { renderFrame } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { useCallback, useEffect, useState } from "react"

/**
 * Demo: Manual Frame Control
 *
 * This demonstrates how to manually control Motion animations frame-by-frame,
 * useful for:
 * - Remotion video rendering
 * - WebXR immersive sessions
 * - Debugging animations step-by-step
 * - Creating scrubable animation timelines
 */
export const App = () => {
    const [manualMode, setManualMode] = useState(false)
    const [currentFrame, setCurrentFrame] = useState(0)
    const [fps] = useState(30)
    const [isAnimating, setIsAnimating] = useState(false)
    const x = useMotionValue(0)

    // Calculate current time in ms
    const currentTime = (currentFrame / fps) * 1000

    // Enable/disable manual timing mode
    useEffect(() => {
        if (manualMode) {
            MotionGlobalConfig.useManualTiming = true
            // Reset to frame 0 when entering manual mode
            setCurrentFrame(0)
            renderFrame({ frame: 0, fps })
        } else {
            MotionGlobalConfig.useManualTiming = undefined
        }
        return () => {
            MotionGlobalConfig.useManualTiming = undefined
        }
    }, [manualMode, fps])

    // Render the current frame when it changes (in manual mode)
    useEffect(() => {
        if (manualMode) {
            renderFrame({ frame: currentFrame, fps })
        }
    }, [currentFrame, manualMode, fps])

    const nextFrame = useCallback(() => {
        setCurrentFrame((f) => f + 1)
    }, [])

    const prevFrame = useCallback(() => {
        setCurrentFrame((f) => Math.max(0, f - 1))
    }, [])

    const goToFrame = useCallback((frame: number) => {
        setCurrentFrame(Math.max(0, frame))
    }, [])

    const toggleAnimation = useCallback(() => {
        setIsAnimating((a) => !a)
    }, [])

    return (
        <div style={containerStyle}>
            <h1 style={titleStyle}>Manual Frame Control Demo</h1>

            {/* Controls */}
            <div style={controlsStyle}>
                <label style={labelStyle}>
                    <input
                        type="checkbox"
                        checked={manualMode}
                        onChange={(e) => setManualMode(e.target.checked)}
                    />
                    Manual Timing Mode
                </label>

                {manualMode && (
                    <>
                        <div style={buttonGroupStyle}>
                            <button
                                style={buttonStyle}
                                onClick={prevFrame}
                                id="prev-frame"
                            >
                                ← Prev Frame
                            </button>
                            <button
                                style={buttonStyle}
                                onClick={nextFrame}
                                id="next-frame"
                            >
                                Next Frame →
                            </button>
                        </div>

                        <div style={sliderContainerStyle}>
                            <label>
                                Frame: {currentFrame} ({currentTime.toFixed(0)}
                                ms)
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="120"
                                value={currentFrame}
                                onChange={(e) =>
                                    goToFrame(parseInt(e.target.value))
                                }
                                style={sliderStyle}
                                id="frame-slider"
                            />
                        </div>

                        <div style={buttonGroupStyle}>
                            <button
                                style={buttonStyle}
                                onClick={() => goToFrame(0)}
                            >
                                Go to Start
                            </button>
                            <button
                                style={buttonStyle}
                                onClick={() => goToFrame(30)}
                            >
                                Go to 1s
                            </button>
                            <button
                                style={buttonStyle}
                                onClick={() => goToFrame(60)}
                            >
                                Go to 2s
                            </button>
                        </div>
                    </>
                )}

                <button
                    style={{
                        ...buttonStyle,
                        backgroundColor: isAnimating ? "#4CAF50" : "#2196F3",
                    }}
                    onClick={toggleAnimation}
                    id="toggle-animation"
                >
                    {isAnimating ? "Reset Animation" : "Start Animation"}
                </button>
            </div>

            {/* Animated element */}
            <div style={stageStyle}>
                <motion.div
                    id="box"
                    data-testid="box"
                    initial={{ x: 0 }}
                    animate={{ x: isAnimating ? 400 : 0 }}
                    transition={{ duration: 2, ease: "linear" }}
                    style={{ ...boxStyle, x }}
                    onAnimationComplete={() => {
                        if (!manualMode) {
                            console.log("Animation complete!")
                        }
                    }}
                />

                {/* Position indicator */}
                <div style={indicatorStyle}>
                    X Position: {Math.round(x.get())}px
                </div>
            </div>

            <div style={stageStyle}>
                <motion.div
                    style={{ ...boxStyle, left: isAnimating ? 400 : 0 }}
                    layout
                    layoutDependency={isAnimating}
                    transition={{ duration: 2 }}
                />
            </div>

            {/* Info panel */}
            <div style={infoStyle}>
                <h3>How it works:</h3>
                <ul>
                    <li>
                        <strong>Manual Timing Mode:</strong> Disables
                        requestAnimationFrame-based updates
                    </li>
                    <li>
                        <strong>Next/Prev Frame:</strong> Advance or rewind by
                        one frame (~33ms at 30fps)
                    </li>
                    <li>
                        <strong>Frame Slider:</strong> Scrub through the
                        animation timeline
                    </li>
                    <li>
                        <strong>FPS:</strong> {fps} frames per second (
                        {(1000 / fps).toFixed(1)}ms per frame)
                    </li>
                </ul>

                <h3>Remotion Integration:</h3>
                <pre style={codeStyle}>
                    {`import { MotionRemotion } from 'motion-remotion'

function MyComposition() {
  return (
    <MotionRemotion>
      <motion.div
        animate={{ x: 100 }}
        transition={{ duration: 1 }}
      />
    </MotionRemotion>
  )
}`}
                </pre>
            </div>
        </div>
    )
}

const containerStyle: React.CSSProperties = {
    padding: 20,
    fontFamily: "system-ui, sans-serif",
    maxWidth: 800,
    margin: "0 auto",
}

const titleStyle: React.CSSProperties = {
    marginBottom: 20,
}

const controlsStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 15,
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
}

const labelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    cursor: "pointer",
}

const buttonGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
}

const buttonStyle: React.CSSProperties = {
    padding: "10px 20px",
    fontSize: 14,
    cursor: "pointer",
    border: "none",
    borderRadius: 4,
    backgroundColor: "#2196F3",
    color: "white",
}

const sliderContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 5,
}

const sliderStyle: React.CSSProperties = {
    width: "100%",
}

const stageStyle: React.CSSProperties = {
    position: "relative",
    height: 150,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    marginBottom: 20,
    overflow: "hidden",
}

const boxStyle: React.CSSProperties = {
    position: "absolute",
    top: 25,
    left: 20,
    width: 100,
    height: 100,
    backgroundColor: "#e94560",
    borderRadius: 8,
}

const indicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 10,
    left: 20,
    color: "white",
    fontSize: 14,
}

const infoStyle: React.CSSProperties = {
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
}

const codeStyle: React.CSSProperties = {
    backgroundColor: "#1a1a2e",
    color: "#e94560",
    padding: 15,
    borderRadius: 4,
    overflow: "auto",
    fontSize: 13,
}
