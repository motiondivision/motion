/**
 * Remotion Integration Tests
 *
 * In production, wrap your composition with `<MotionRemotion>` from `motion-remotion`.
 */

import { motionValue, Variants, renderFrame } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { createContext, useContext, ReactNode, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { act } from "react"
import { motion, AnimatePresence } from "../../"
import { render } from "../../jest.setup"

// Mock Remotion API
interface VideoConfig {
    fps: number
    width: number
    height: number
    durationInFrames: number
    id: string
}

interface RemotionContextValue {
    frame: number
    config: VideoConfig
}

const RemotionContext = createContext<RemotionContextValue | null>(null)

function useCurrentFrame(): number {
    const ctx = useContext(RemotionContext)
    if (!ctx) throw new Error("useCurrentFrame must be used within Remotion context")
    return ctx.frame
}

function useVideoConfig(): VideoConfig {
    const ctx = useContext(RemotionContext)
    if (!ctx) throw new Error("useVideoConfig must be used within Remotion context")
    return ctx.config
}

function Sequence({
    from = 0,
    children,
}: {
    from?: number
    durationInFrames?: number
    children: ReactNode
}) {
    const parentFrame = useCurrentFrame()
    const config = useVideoConfig()
    const relativeFrame = parentFrame - from

    return (
        <RemotionContext.Provider
            value={{ frame: relativeFrame, config }}
        >
            {relativeFrame >= 0 ? children : null}
        </RemotionContext.Provider>
    )
}

function AbsoluteFill({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                ...style,
            }}
        >
            {children}
        </div>
    )
}

/**
 * Test bridge that mirrors MotionRemotion from the plus repo.
 * Uses renderFrame with style-capture for backward scrubbing.
 */
function MotionRemotionBridge({ children }: { children: ReactNode }) {
    const currentFrame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const prevFrame = useRef<number>(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const styleCacheRef = useRef<Map<number, Map<Element, { style: string; attrs?: Record<string, string> }>>>(new Map())

    useInsertionEffect(() => {
        MotionGlobalConfig.useManualTiming = true
        return () => { MotionGlobalConfig.useManualTiming = undefined }
    }, [])

    useLayoutEffect(() => {
        const captureStyles = (frameNum: number) => {
            if (!containerRef.current) return
            const elements = containerRef.current.querySelectorAll('*')
            const frameStyles = new Map<Element, { style: string; attrs?: Record<string, string> }>()
            elements.forEach((el) => {
                const entry: { style: string; attrs?: Record<string, string> } = {
                    style: (el as HTMLElement).style.cssText,
                }
                if (el instanceof SVGElement && !(el instanceof HTMLElement)) {
                    const attrs: Record<string, string> = {}
                    el.getAttributeNames().forEach((name) => {
                        attrs[name] = el.getAttribute(name)!
                    })
                    entry.attrs = attrs
                }
                frameStyles.set(el, entry)
            })
            styleCacheRef.current.set(frameNum, frameStyles)
        }

        const applyCachedStyles = (frameNum: number) => {
            const frameStyles = styleCacheRef.current.get(frameNum)
            if (!frameStyles) return false
            frameStyles.forEach((cached, el) => {
                (el as HTMLElement).style.cssText = cached.style
                if (cached.attrs) {
                    for (const name in cached.attrs) {
                        (el as SVGElement).setAttribute(name, cached.attrs[name])
                    }
                }
            })
            return true
        }

        if (prevFrame.current < 0) {
            renderFrame({ frame: currentFrame, fps })
            captureStyles(currentFrame)
        } else if (currentFrame > prevFrame.current) {
            // Forward: render intermediate frames
            for (let i = prevFrame.current + 1; i <= currentFrame; i++) {
                renderFrame({ frame: i, fps })
                captureStyles(i)
            }
        } else if (currentFrame < prevFrame.current) {
            // Backward: re-render from 0 to update motionValues,
            // then apply cached styles for layout animations
            for (let i = 0; i <= currentFrame; i++) {
                renderFrame({ frame: i, fps })
            }
            applyCachedStyles(currentFrame)
        }

        prevFrame.current = currentFrame
    }, [currentFrame, fps])

    return <div ref={containerRef} style={{ display: 'contents' }}>{children}</div>
}

describe("Remotion Integration", () => {
    describe("Mocked Remotion Environment", () => {
        test("renders correctly at typical Remotion FPS values (30fps)", async () => {
            const x = motionValue(0)
            const snapshots: number[] = []

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60, // 2 seconds
                id: "test-30fps",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Test key frames: 0, 15 (0.5s), 30 (1s), 45 (1.5s), 60 (2s)
            const keyFrames = [0, 15, 30, 45, 60]

            for (const frame of keyFrames) {
                await act(async () => {
                    rerender(<Component frame={frame} />)
                })
                snapshots.push(Math.round(x.get()))
            }

            // At 0 frames: animation starts
            // At 15 frames (500ms): ~50%
            // At 30 frames (1000ms): 100%
            // At 45 & 60 frames: stays at 100%
            expect(snapshots[1]).toBeCloseTo(50, -1) // ~50 at halfway
            expect(snapshots[2]).toBe(100) // Complete at 1s
            expect(snapshots[3]).toBe(100) // Stays complete
            expect(snapshots[4]).toBe(100) // Stays complete
        })

        test("renders correctly at 60fps (smooth video)", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 60,
                width: 1920,
                height: 1080,
                durationInFrames: 120, // 2 seconds
                id: "test-60fps",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // At 30 frames at 60fps = 500ms = 50%
            await act(async () => {
                rerender(<Component frame={30} />)
            })
            expect(Math.round(x.get())).toBe(50)

            // At 60 frames at 60fps = 1000ms = 100%
            await act(async () => {
                rerender(<Component frame={60} />)
            })
            expect(Math.round(x.get())).toBe(100)
        })

        test("renders correctly at 24fps (film standard)", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 24,
                width: 1920,
                height: 1080,
                durationInFrames: 48, // 2 seconds
                id: "test-24fps",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // At 12 frames at 24fps = 500ms = ~50%
            await act(async () => {
                rerender(<Component frame={12} />)
            })
            expect(Math.round(x.get())).toBeCloseTo(50, -1)

            // At 24 frames at 24fps = 1000ms = 100%
            await act(async () => {
                rerender(<Component frame={24} />)
            })
            expect(Math.round(x.get())).toBeCloseTo(100, -1)
        })
    })

    describe("Spring Animations (Motion advantage over Remotion)", () => {
        test("spring with stiffness/damping produces natural overshoot", async () => {
            const scale = motionValue(0)
            const values: number[] = []

            const config: VideoConfig = {
                fps: 60,
                width: 1920,
                height: 1080,
                durationInFrames: 120,
                id: "spring-test",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 10, // Low damping = more bounce
                            }}
                            style={{ scale }}
                            onUpdate={() => values.push(scale.get())}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Render through the animation
            for (let f = 1; f <= 90; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // With low damping, spring should overshoot past 1
            const maxValue = Math.max(...values)
            expect(maxValue).toBeGreaterThan(1)

            // Eventually settles to 1
            expect(Math.abs(scale.get() - 1)).toBeLessThan(0.01)
        })

        test("spring with high damping produces smooth approach", async () => {
            const scale = motionValue(0)
            const values: number[] = []

            const config: VideoConfig = {
                fps: 60,
                width: 1920,
                height: 1080,
                durationInFrames: 120,
                id: "spring-damped",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 100,
                                damping: 20, // High damping = no bounce
                            }}
                            style={{ scale }}
                            onUpdate={() => values.push(scale.get())}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            for (let f = 1; f <= 90; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // With high damping, should not significantly overshoot
            const maxValue = Math.max(...values)
            expect(maxValue).toBeLessThan(1.05) // Allow tiny overshoot from numerical precision
        })

        test("bouncy entrance animation for video intro", async () => {
            const y = motionValue(100)
            const opacity = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "intro-bounce",
            }

            // Simulates a title card bouncing in from below
            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                                y: {
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 15,
                                },
                                opacity: { duration: 0.3 },
                            }}
                            style={{ y, opacity }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Render a few frames to start the animation
            for (let f = 1; f <= 30; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // After 30 frames (1 second), opacity should be fully animated
            expect(opacity.get()).toBeCloseTo(1, 1)

            // Y should be approaching 0 with possible bounce
            expect(Math.abs(y.get())).toBeLessThan(20)
        })
    })

    describe("Backward Scrubbing", () => {
        test("linear animation scrubs backward to correct intermediate values", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "backward-linear",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Forward to frame 30 (1s = 100%)
            for (let f = 1; f <= 30; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }
            expect(Math.round(x.get())).toBe(100)

            // Scrub backward to frame 15 (500ms = 50%)
            await act(async () => {
                rerender(<Component frame={15} />)
            })
            expect(Math.round(x.get())).toBeCloseTo(50, -1)

            // Scrub backward to frame 0 (0ms = 0%)
            await act(async () => {
                rerender(<Component frame={0} />)
            })
            expect(Math.round(x.get())).toBe(0)
        })

        test("spring animation scrubs backward correctly (analytical solution)", async () => {
            const scale = motionValue(0)

            const config: VideoConfig = {
                fps: 60,
                width: 1920,
                height: 1080,
                durationInFrames: 120,
                id: "backward-spring",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 10,
                            }}
                            style={{ scale }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Record values on forward pass
            const forwardValues: number[] = []
            for (let f = 1; f <= 60; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
                forwardValues.push(scale.get())
            }

            // Scrub backward to frame 15 — should match the value from the forward pass
            await act(async () => {
                rerender(<Component frame={15} />)
            })
            expect(scale.get()).toBeCloseTo(forwardValues[14], 1)

            // Scrub backward to frame 5
            await act(async () => {
                rerender(<Component frame={5} />)
            })
            expect(scale.get()).toBeCloseTo(forwardValues[4], 1)
        })

        test("un-finish behavior: scrub past end, back to middle, forward past end again", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "unfinish",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Forward past animation end (frame 30 = 1s)
            for (let f = 1; f <= 45; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }
            expect(Math.round(x.get())).toBe(100)

            // Scrub back to middle of animation
            await act(async () => {
                rerender(<Component frame={15} />)
            })
            expect(Math.round(x.get())).toBeCloseTo(50, -1)

            // Scrub forward past end again
            for (let f = 16; f <= 45; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }
            expect(Math.round(x.get())).toBe(100)
        })
    })

    describe("AnimatePresence for Scene Transitions", () => {
        test("exit animations complete before removal", async () => {
            const opacity = motionValue(1)
            let wasRemoved = false

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "exit-test",
            }

            const Component = ({
                frame,
                isVisible,
            }: {
                frame: number
                isVisible: boolean
            }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <AnimatePresence
                            onExitComplete={() => {
                                wasRemoved = true
                            }}
                        >
                            {isVisible && (
                                <motion.div
                                    key="scene"
                                    initial={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5, ease: "linear" }}
                                    style={{ opacity }}
                                />
                            )}
                        </AnimatePresence>
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(
                <Component frame={0} isVisible={true} />
            )

            // Render a few frames with component visible
            await act(async () => {
                rerender(<Component frame={5} isVisible={true} />)
            })

            // Hide the component - should trigger exit animation
            await act(async () => {
                rerender(<Component frame={10} isVisible={false} />)
            })

            // Advance through exit animation
            for (let f = 11; f <= 30; f++) {
                await act(async () => {
                    rerender(<Component frame={f} isVisible={false} />)
                })
            }

            // Exit animation should have completed
            expect(wasRemoved).toBe(true)
        })

        test("cross-fade between scenes using mode='wait'", async () => {
            const scene1Opacity = motionValue(1)
            const scene2Opacity = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "crossfade-test",
            }

            const Component = ({
                frame,
                currentScene,
            }: {
                frame: number
                currentScene: number
            }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <AnimatePresence mode="wait">
                            {currentScene === 1 ? (
                                <motion.div
                                    key="scene1"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "linear" }}
                                    style={{ opacity: scene1Opacity }}
                                >
                                    Scene 1
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="scene2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "linear" }}
                                    style={{ opacity: scene2Opacity }}
                                >
                                    Scene 2
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(
                <Component frame={0} currentScene={1} />
            )

            // Advance scene 1 entrance
            for (let f = 1; f <= 15; f++) {
                await act(async () => {
                    rerender(<Component frame={f} currentScene={1} />)
                })
            }

            // Scene 1 should be visible
            expect(scene1Opacity.get()).toBeCloseTo(1, 1)

            // Switch to scene 2
            for (let f = 16; f <= 45; f++) {
                await act(async () => {
                    rerender(<Component frame={f} currentScene={2} />)
                })
            }

            // Scene 2 should now be visible
            expect(scene2Opacity.get()).toBeCloseTo(1, 1)
        })
    })

    describe("Staggered Children Animations", () => {
        test("orchestrated reveals using variants and staggerChildren", async () => {
            const opacities = [motionValue(0), motionValue(0), motionValue(0)]
            const animationOrder: number[] = []

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "stagger-test",
            }

            const containerVariants: Variants = {
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: 0.2, // 200ms between each child
                    },
                },
            }

            const itemVariants: Variants = {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.1 } },
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={containerVariants}
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    variants={itemVariants}
                                    style={{ opacity: opacities[i] }}
                                    onAnimationComplete={() => {
                                        if (!animationOrder.includes(i)) {
                                            animationOrder.push(i)
                                        }
                                    }}
                                />
                            ))}
                        </motion.div>
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Render through animation (stagger of 200ms means items animate at 0ms, 200ms, 400ms)
            for (let f = 1; f <= 30; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // All items should be visible after 1 second
            expect(opacities[0].get()).toBeCloseTo(1, 1)
            expect(opacities[1].get()).toBeCloseTo(1, 1)
            expect(opacities[2].get()).toBeCloseTo(1, 1)
        })

        test("title card with staggered text reveal", async () => {
            const letterOpacities = Array(5)
                .fill(0)
                .map(() => motionValue(0))

            const config: VideoConfig = {
                fps: 60,
                width: 1920,
                height: 1080,
                durationInFrames: 120,
                id: "title-reveal",
            }

            const containerVariants: Variants = {
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: 0.05, // Fast stagger for text
                    },
                },
            }

            const letterVariants: Variants = {
                hidden: { opacity: 0, y: 20 },
                visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.1 },
                },
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={containerVariants}
                        >
                            {"HELLO".split("").map((letter, i) => (
                                <motion.span
                                    key={i}
                                    variants={letterVariants}
                                    style={{ opacity: letterOpacities[i] }}
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </motion.div>
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // After 30 frames (0.5s at 60fps), all letters should be revealed
            for (let f = 1; f <= 30; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // First letter should definitely be visible
            expect(letterOpacities[0].get()).toBeCloseTo(1, 1)
            // Last letter should also be visible after stagger completes
            expect(letterOpacities[4].get()).toBeCloseTo(1, 1)
        })
    })

    describe("Sequential Frame Rendering (Video Export)", () => {
        test("sequential frame-by-frame rendering for video export", async () => {
            const x = motionValue(0)
            const snapshots: number[] = []

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "sequential-export",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Simulate video export: sequential frames 0, 1, 2, ... 30
            for (let frame = 0; frame <= 30; frame++) {
                await act(async () => {
                    rerender(<Component frame={frame} />)
                })
                if (frame % 10 === 0) {
                    snapshots.push(Math.round(x.get()))
                }
            }

            // At 30fps with 1s duration:
            // frame 0 = 0ms = 0%
            // frame 10 = 333ms = ~33%
            // frame 20 = 667ms = ~67%
            // frame 30 = 1000ms = 100%
            expect(snapshots[0]).toBe(0)
            expect(snapshots[1]).toBeCloseTo(33, -1)
            expect(snapshots[2]).toBeCloseTo(67, -1)
            expect(snapshots[3]).toBe(100)
        })

        test("animations stay at final value after completion", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "stay-complete",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Render through entire animation and beyond
            for (let frame = 0; frame <= 60; frame++) {
                await act(async () => {
                    rerender(<Component frame={frame} />)
                })
            }

            // Animation completes at frame 30, should stay at 100 through frame 60
            expect(Math.round(x.get())).toBe(100)
        })
    })

    describe("Sequence Component (time-shifted children)", () => {
        test("animations in Sequence receive relative frame numbers", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 90,
                id: "sequence-test",
            }

            // Content that should animate relative to sequence start
            const SequencedContent = () => {
                const frame = useCurrentFrame()
                const { fps } = useVideoConfig()
                const prevFrame = useRef<number>(-1)

                useInsertionEffect(() => {
                    MotionGlobalConfig.useManualTiming = true
                    return () => { MotionGlobalConfig.useManualTiming = undefined }
                }, [])

                useLayoutEffect(() => {
                    if (prevFrame.current < 0) {
                        renderFrame({ frame, fps })
                    } else if (frame > prevFrame.current) {
                        for (let i = prevFrame.current + 1; i <= frame; i++) {
                            renderFrame({ frame: i, fps })
                        }
                    } else if (frame < prevFrame.current) {
                        renderFrame({ frame, fps })
                    }
                    prevFrame.current = frame
                }, [frame, fps])

                return (
                    <motion.div
                        initial={{ x: 0 }}
                        animate={{ x: 100 }}
                        transition={{ duration: 1, ease: "linear" }}
                        style={{ x }}
                    />
                )
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <Sequence from={30}>
                        <SequencedContent />
                    </Sequence>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Before sequence starts (frame < 30), content should not be rendered
            await act(async () => {
                rerender(<Component frame={20} />)
            })

            // At frame 30, sequence starts (relative frame 0)
            await act(async () => {
                rerender(<Component frame={30} />)
            })
            expect(Math.round(x.get())).toBe(0)

            // At frame 45, relative frame is 15 (500ms at 30fps = 50%)
            await act(async () => {
                rerender(<Component frame={45} />)
            })
            expect(Math.round(x.get())).toBe(50)

            // At frame 60, relative frame is 30 (1000ms = 100%)
            await act(async () => {
                rerender(<Component frame={60} />)
            })
            expect(Math.round(x.get())).toBe(100)
        })
    })

    describe("Complete Remotion Composition Example", () => {
        test("full video composition with intro, content, and outro", async () => {
            const introOpacity = motionValue(0)
            const contentScale = motionValue(0)
            const outroY = motionValue(50)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 150, // 5 seconds
                id: "full-composition",
            }

            const SceneBridge = ({ children }: { children: ReactNode }) => {
                const frame = useCurrentFrame()
                const { fps } = useVideoConfig()
                const prevFrame = useRef<number>(-1)

                useInsertionEffect(() => {
                    MotionGlobalConfig.useManualTiming = true
                    return () => { MotionGlobalConfig.useManualTiming = undefined }
                }, [])

                useLayoutEffect(() => {
                    if (prevFrame.current < 0) {
                        renderFrame({ frame, fps })
                    } else if (frame > prevFrame.current) {
                        for (let i = prevFrame.current + 1; i <= frame; i++) {
                            renderFrame({ frame: i, fps })
                        }
                    } else if (frame < prevFrame.current) {
                        renderFrame({ frame, fps })
                    }
                    prevFrame.current = frame
                }, [frame, fps])

                return <>{children}</>
            }

            // A realistic video composition structure
            const Composition = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <AbsoluteFill>
                        {/* Intro: frames 0-30 (first second) */}
                        <Sequence from={0} durationInFrames={30}>
                            <SceneBridge>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5, ease: "linear" }}
                                    style={{ opacity: introOpacity }}
                                >
                                    Intro
                                </motion.div>
                            </SceneBridge>
                        </Sequence>

                        {/* Main content: frames 30-120 */}
                        <Sequence from={30} durationInFrames={90}>
                            <SceneBridge>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 20,
                                    }}
                                    style={{ scale: contentScale }}
                                >
                                    Content
                                </motion.div>
                            </SceneBridge>
                        </Sequence>

                        {/* Outro: frames 120-150 */}
                        <Sequence from={120} durationInFrames={30}>
                            <SceneBridge>
                                <motion.div
                                    initial={{ y: 50 }}
                                    animate={{ y: 0 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    style={{ y: outroY }}
                                >
                                    Outro
                                </motion.div>
                            </SceneBridge>
                        </Sequence>
                    </AbsoluteFill>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Composition frame={0} />)

            // Test intro sequence
            for (let f = 1; f <= 15; f++) {
                await act(async () => {
                    rerender(<Composition frame={f} />)
                })
            }
            expect(introOpacity.get()).toBeCloseTo(1, 1) // Intro faded in

            // Test content sequence
            for (let f = 31; f <= 60; f++) {
                await act(async () => {
                    rerender(<Composition frame={f} />)
                })
            }
            expect(contentScale.get()).toBeCloseTo(1, 0) // Content scaled in

            // Test outro sequence
            for (let f = 121; f <= 140; f++) {
                await act(async () => {
                    rerender(<Composition frame={f} />)
                })
            }
            expect(Math.abs(outroY.get())).toBeLessThan(10) // Outro slid in
        })
    })

    describe("Edge Cases", () => {
        test("handles rapid frame changes (video export simulation)", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "rapid-frames",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            // Simulate rapid frame rendering (like video export)
            for (let f = 0; f < 60; f++) {
                await act(async () => {
                    rerender(<Component frame={f} />)
                })
            }

            // Should end at correct final value
            expect(Math.round(x.get())).toBe(100)
        })

        test("handles same frame being rendered multiple times", async () => {
            const x = motionValue(0)
            let renderCount = 0

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "same-frame",
            }

            const Component = ({ frame }: { frame: number }) => {
                renderCount++
                return (
                    <RemotionContext.Provider value={{ frame, config }}>
                        <MotionRemotionBridge>
                            <motion.div
                                initial={{ x: 0 }}
                                animate={{ x: 100 }}
                                transition={{ duration: 1, ease: "linear" }}
                                style={{ x }}
                            />
                        </MotionRemotionBridge>
                    </RemotionContext.Provider>
                )
            }

            const { rerender } = render(<Component frame={15} />)

            const valueAfterFirst = x.get()

            // Re-render same frame multiple times
            await act(async () => {
                rerender(<Component frame={15} />)
            })
            await act(async () => {
                rerender(<Component frame={15} />)
            })

            // Value should remain stable
            expect(x.get()).toBe(valueAfterFirst)
        })

        test("handles animation with zero duration", async () => {
            const x = motionValue(0)

            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 30,
                id: "instant",
            }

            const Component = ({ frame }: { frame: number }) => (
                <RemotionContext.Provider value={{ frame, config }}>
                    <MotionRemotionBridge>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: 100 }}
                            transition={{ duration: 0 }}
                            style={{ x }}
                        />
                    </MotionRemotionBridge>
                </RemotionContext.Provider>
            )

            const { rerender } = render(<Component frame={0} />)

            await act(async () => {
                rerender(<Component frame={1} />)
            })

            // Instant transition should complete immediately
            expect(x.get()).toBe(100)
        })
    })

    describe("Layout Animation Scrubbing", () => {
        /**
         * Helper to mock getBoundingClientRect per-element.
         * The projection system discards snapshots when getBoundingClientRect
         * returns zero-size boxes (create-projection-node.ts updateSnapshot),
         * so we must provide non-zero boxes in JSDOM.
         */
        function createLayoutMock() {
            const boxes = new Map<Element, DOMRect>()
            const original = Element.prototype.getBoundingClientRect

            Element.prototype.getBoundingClientRect = function () {
                const box = boxes.get(this)
                if (box) return box
                return original.call(this)
            }

            return {
                setBox(
                    el: Element,
                    rect: {
                        left: number
                        top: number
                        width: number
                        height: number
                    }
                ) {
                    boxes.set(el, {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        left: rect.left,
                        right: rect.left + rect.width,
                        bottom: rect.top + rect.height,
                        toJSON() {},
                    } as DOMRect)
                },
                cleanup() {
                    Element.prototype.getBoundingClientRect = original
                    boxes.clear()
                },
            }
        }

        /**
         * The projection system schedules layout updates via queueMicrotask.
         * React's act() doesn't always flush custom microtask batchers.
         * This helper ensures the projection microtask queue is drained.
         */
        async function flushMicrotasks() {
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }

        let layoutMock: ReturnType<typeof createLayoutMock>

        beforeEach(() => {
            layoutMock = createLayoutMock()
        })

        afterEach(() => {
            layoutMock.cleanup()
        })

        /**
         * Parse translate3d and scale from a CSS transform string.
         * Returns { tx, ty, sx, sy } or null if transform is "none" or empty.
         */
        function parseProjectionTransform(transform: string) {
            if (!transform || transform === "none") return null

            let tx = 0,
                ty = 0,
                sx = 1,
                sy = 1

            const translate3dMatch = transform.match(
                /translate3d\(\s*([-\d.]+)px,\s*([-\d.]+)px,\s*([-\d.]+)px\s*\)/
            )
            if (translate3dMatch) {
                tx = parseFloat(translate3dMatch[1])
                ty = parseFloat(translate3dMatch[2])
            }

            const scaleMatch = transform.match(
                /scale\(\s*([-\d.]+)(?:,\s*([-\d.]+))?\s*\)/
            )
            if (scaleMatch) {
                sx = parseFloat(scaleMatch[1])
                sy = scaleMatch[2] !== undefined ? parseFloat(scaleMatch[2]) : sx
            }

            return { tx, ty, sx, sy }
        }

        test("basic layout animation generates projection transforms", async () => {
            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "layout-basic",
            }

            let elementRef: HTMLDivElement | null = null

            const LayoutComponent = ({
                frame,
                wide,
            }: {
                frame: number
                wide: boolean
            }) => {
                const ref = useRef<HTMLDivElement>(null)

                useLayoutEffect(() => {
                    if (ref.current) {
                        elementRef = ref.current
                        layoutMock.setBox(
                            ref.current,
                            wide
                                ? {
                                      left: 200,
                                      top: 0,
                                      width: 200,
                                      height: 100,
                                  }
                                : {
                                      left: 0,
                                      top: 0,
                                      width: 100,
                                      height: 100,
                                  }
                        )
                    }
                }, [wide])

                return (
                    <RemotionContext.Provider value={{ frame, config }}>
                        <MotionRemotionBridge>
                            <motion.div
                                ref={ref}
                                data-testid="layout-box"
                                layout
                                transition={{
                                    layout: {
                                        duration: 1,
                                        ease: "linear",
                                    },
                                }}
                            />
                        </MotionRemotionBridge>
                    </RemotionContext.Provider>
                )
            }

            // Mount with box A (narrow)
            const { rerender } = render(
                <LayoutComponent frame={0} wide={false} />,
                false
            )

            // Advance a frame to initialize
            await act(async () => {
                rerender(<LayoutComponent frame={1} wide={false} />)
            })

            expect(elementRef).not.toBeNull()

            // Trigger layout change to box B (wide)
            await act(async () => {
                rerender(<LayoutComponent frame={2} wide={true} />)
            })
            await flushMicrotasks()

            const transform = elementRef!.style.transform
            const parsed = parseProjectionTransform(transform)

            // The projection system should have generated a non-identity transform
            // to animate from box A to box B
            expect(parsed).not.toBeNull()
            if (parsed) {
                // At the start of the animation, we expect either translation or scale
                // to be non-identity (the element moved from 0,0 100x100 to 200,0 200x100)
                const hasTranslation = parsed.tx !== 0 || parsed.ty !== 0
                const hasScale = parsed.sx !== 1 || parsed.sy !== 1
                expect(hasTranslation || hasScale).toBe(true)
            }

            // Advance to animation end (30 frames at 30fps = 1s)
            for (let f = 3; f <= 32; f++) {
                await act(async () => {
                    rerender(<LayoutComponent frame={f} wide={true} />)
                })
            }

            // At the end of the animation, transform should be identity
            const endTransform = elementRef!.style.transform
            const endParsed = parseProjectionTransform(endTransform)
            if (endParsed) {
                expect(Math.abs(endParsed.tx)).toBeLessThan(0.1)
                expect(Math.abs(endParsed.ty)).toBeLessThan(0.1)
                expect(endParsed.sx).toBeCloseTo(1, 1)
                expect(endParsed.sy).toBeCloseTo(1, 1)
            }
            // "none" or empty is also acceptable at end
        })

        test("layout animation values progress over frames", async () => {
            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "layout-progress",
            }

            let elementRef: HTMLDivElement | null = null

            const LayoutComponent = ({
                frame,
                wide,
            }: {
                frame: number
                wide: boolean
            }) => {
                const ref = useRef<HTMLDivElement>(null)

                useLayoutEffect(() => {
                    if (ref.current) {
                        elementRef = ref.current
                        layoutMock.setBox(
                            ref.current,
                            wide
                                ? {
                                      left: 200,
                                      top: 0,
                                      width: 200,
                                      height: 100,
                                  }
                                : {
                                      left: 0,
                                      top: 0,
                                      width: 100,
                                      height: 100,
                                  }
                        )
                    }
                }, [wide])

                return (
                    <RemotionContext.Provider value={{ frame, config }}>
                        <MotionRemotionBridge>
                            <motion.div
                                ref={ref}
                                layout
                                transition={{
                                    layout: {
                                        duration: 1,
                                        ease: "linear",
                                    },
                                }}
                            />
                        </MotionRemotionBridge>
                    </RemotionContext.Provider>
                )
            }

            // Mount with box A
            const { rerender } = render(
                <LayoutComponent frame={0} wide={false} />,
                false
            )

            await act(async () => {
                rerender(<LayoutComponent frame={1} wide={false} />)
            })

            // Trigger layout change
            await act(async () => {
                rerender(<LayoutComponent frame={2} wide={true} />)
            })
            await flushMicrotasks()

            // Record transforms at early, middle, and late frames
            const transforms: string[] = []

            // Early frame
            await act(async () => {
                rerender(<LayoutComponent frame={5} wide={true} />)
            })
            transforms.push(elementRef!.style.transform)

            // Middle frame (~halfway through 1s animation at 30fps)
            await act(async () => {
                rerender(<LayoutComponent frame={17} wide={true} />)
            })
            transforms.push(elementRef!.style.transform)

            // Late frame (near end)
            await act(async () => {
                rerender(<LayoutComponent frame={30} wide={true} />)
            })
            transforms.push(elementRef!.style.transform)

            // Verify that values change between frames (animation is progressing)
            // At minimum, the early and late transforms should differ
            expect(transforms[0]).not.toBe(transforms[2])
        })

        test("backward scrubbing replays cached layout transforms", async () => {
            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "layout-backward",
            }

            let elementRef: HTMLDivElement | null = null

            const LayoutComponent = ({
                frame,
                wide,
            }: {
                frame: number
                wide: boolean
            }) => {
                const ref = useRef<HTMLDivElement>(null)

                useLayoutEffect(() => {
                    if (ref.current) {
                        elementRef = ref.current
                        layoutMock.setBox(
                            ref.current,
                            wide
                                ? {
                                      left: 200,
                                      top: 0,
                                      width: 200,
                                      height: 100,
                                  }
                                : {
                                      left: 0,
                                      top: 0,
                                      width: 100,
                                      height: 100,
                                  }
                        )
                    }
                }, [wide])

                return (
                    <RemotionContext.Provider value={{ frame, config }}>
                        <MotionRemotionBridge>
                            <motion.div
                                ref={ref}
                                layout
                                transition={{
                                    layout: {
                                        duration: 1,
                                        ease: "linear",
                                    },
                                }}
                            />
                        </MotionRemotionBridge>
                    </RemotionContext.Provider>
                )
            }

            // Mount with box A
            const { rerender } = render(
                <LayoutComponent frame={0} wide={false} />,
                false
            )

            await act(async () => {
                rerender(<LayoutComponent frame={1} wide={false} />)
            })

            // Trigger layout change at frame 2
            await act(async () => {
                rerender(<LayoutComponent frame={2} wide={true} />)
            })
            await flushMicrotasks()

            // Record transform at key frames during forward pass
            const forwardTransforms: Record<number, string> = {}

            for (let f = 3; f <= 32; f++) {
                await act(async () => {
                    rerender(<LayoutComponent frame={f} wide={true} />)
                })
                if (f === 10 || f === 15 || f === 20) {
                    forwardTransforms[f] = elementRef!.style.transform
                }
            }

            // Scrub backward to frame 15
            await act(async () => {
                rerender(<LayoutComponent frame={15} wide={true} />)
            })
            const backwardTransform15 = elementRef!.style.transform

            // The backward-scrubbed transform should match what was recorded
            // during the forward pass at the same frame
            expect(backwardTransform15).toBe(forwardTransforms[15])
        })

        test("layout animation with layout='position' (only translate, no scale)", async () => {
            const config: VideoConfig = {
                fps: 30,
                width: 1920,
                height: 1080,
                durationInFrames: 60,
                id: "layout-position",
            }

            let elementRef: HTMLDivElement | null = null

            const LayoutComponent = ({
                frame,
                moved,
            }: {
                frame: number
                moved: boolean
            }) => {
                const ref = useRef<HTMLDivElement>(null)

                useLayoutEffect(() => {
                    if (ref.current) {
                        elementRef = ref.current
                        // Same size boxes, different positions
                        layoutMock.setBox(
                            ref.current,
                            moved
                                ? {
                                      left: 200,
                                      top: 100,
                                      width: 100,
                                      height: 100,
                                  }
                                : {
                                      left: 0,
                                      top: 0,
                                      width: 100,
                                      height: 100,
                                  }
                        )
                    }
                }, [moved])

                return (
                    <RemotionContext.Provider value={{ frame, config }}>
                        <MotionRemotionBridge>
                            <motion.div
                                ref={ref}
                                layout="position"
                                transition={{
                                    layout: {
                                        duration: 1,
                                        ease: "linear",
                                    },
                                }}
                            />
                        </MotionRemotionBridge>
                    </RemotionContext.Provider>
                )
            }

            // Mount with box A
            const { rerender } = render(
                <LayoutComponent frame={0} moved={false} />,
                false
            )

            await act(async () => {
                rerender(<LayoutComponent frame={1} moved={false} />)
            })

            // Trigger layout change
            await act(async () => {
                rerender(<LayoutComponent frame={2} moved={true} />)
            })
            await flushMicrotasks()

            // Advance a few frames into the animation
            await act(async () => {
                rerender(<LayoutComponent frame={5} moved={true} />)
            })

            const transform = elementRef!.style.transform
            const parsed = parseProjectionTransform(transform)

            // With layout="position" and same-sized boxes,
            // should have translation but scale should be 1
            expect(parsed).not.toBeNull()
            if (parsed) {
                const hasTranslation = parsed.tx !== 0 || parsed.ty !== 0
                expect(hasTranslation).toBe(true)
                expect(parsed.sx).toBeCloseTo(1, 1)
                expect(parsed.sy).toBeCloseTo(1, 1)
            }
        })
    })
})
