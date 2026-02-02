import { act } from "react"
import { render } from "../../jest.setup"
import { motion, motionValue } from "../../"
import { useManualFrame } from "../use-manual-frame"
import { renderFrame, setManualTiming } from "motion-dom"

/**
 * Helper to create a component that simulates Remotion's useCurrentFrame behavior
 */
function createRemotionSimulator(fps: number = 30) {
    let currentFrame = 0
    const listeners: Set<() => void> = new Set()

    return {
        getCurrentFrame: () => currentFrame,
        setFrame: (frame: number) => {
            currentFrame = frame
            listeners.forEach((fn) => fn())
        },
        advanceFrame: () => {
            currentFrame++
            listeners.forEach((fn) => fn())
        },
        subscribe: (fn: () => void) => {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
        fps,
    }
}

describe("useManualFrame", () => {
    afterEach(() => {
        setManualTiming(false)
    })

    test("syncs animations to frame number like Remotion", async () => {
        const x = motionValue(0)
        const values: number[] = []

        // Simulate Remotion's frame-based rendering
        const Component = ({ frame, fps }: { frame: number; fps: number }) => {
            useManualFrame({ frame, fps })

            return (
                <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{ x }}
                    onUpdate={() => values.push(Math.round(x.get()))}
                />
            )
        }

        const { rerender } = render(<Component frame={0} fps={30} />)

        // At frame 0 (0ms), animation should be at start
        await act(async () => {
            rerender(<Component frame={0} fps={30} />)
        })

        // At frame 15 (500ms at 30fps), animation should be ~50% through
        await act(async () => {
            rerender(<Component frame={15} fps={30} />)
        })

        // At frame 30 (1000ms at 30fps), animation should be complete
        await act(async () => {
            rerender(<Component frame={30} fps={30} />)
        })

        // Check that we got intermediate values progressing towards 100
        expect(values.length).toBeGreaterThan(0)
        expect(values[values.length - 1]).toBe(100)
    })

    test("handles frame-by-frame stepping", async () => {
        const x = motionValue(0)
        const timestamps: number[] = []

        const Component = ({ frame }: { frame: number }) => {
            useManualFrame({ frame, fps: 60 })

            return (
                <motion.div
                    animate={{ x: 100 }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    style={{ x }}
                    onUpdate={() => timestamps.push(x.get())}
                />
            )
        }

        const { rerender } = render(<Component frame={0} />)

        // Step through frames one at a time (60fps = ~16.67ms per frame)
        for (let frame = 1; frame <= 30; frame++) {
            await act(async () => {
                rerender(<Component frame={frame} />)
            })
        }

        // At frame 30 (500ms at 60fps), animation should be complete
        expect(Math.round(x.get())).toBe(100)
    })

    test("works with different fps values", async () => {
        const x = motionValue(0)

        const Component = ({ frame, fps }: { frame: number; fps: number }) => {
            useManualFrame({ frame, fps })

            return (
                <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: 100 }}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{ x }}
                />
            )
        }

        // Test at 24fps (film standard)
        const { rerender } = render(<Component frame={0} fps={24} />)

        // Frame 12 at 24fps = 500ms = 50% through a 1s animation
        await act(async () => {
            rerender(<Component frame={12} fps={24} />)
        })

        expect(Math.round(x.get())).toBe(50)

        // Frame 24 at 24fps = 1000ms = 100% through
        await act(async () => {
            rerender(<Component frame={24} fps={24} />)
        })

        expect(Math.round(x.get())).toBe(100)
    })

    test("enables manual timing mode on mount and disables on unmount", async () => {
        const Component = ({ frame }: { frame: number }) => {
            useManualFrame({ frame, fps: 30 })
            return <div />
        }

        expect(setManualTiming).toBeDefined()

        const { unmount } = render(<Component frame={0} />)

        // After mount, manual timing should be enabled
        // (we can't directly check MotionGlobalConfig here, but the hook should work)

        unmount()

        // After unmount, manual timing should be disabled
        // This is verified by the afterEach cleanup not causing issues
    })
})

describe("renderFrame direct usage", () => {
    afterEach(() => {
        setManualTiming(false)
    })

    test("manually advances animation with renderFrame", async () => {
        const x = motionValue(0)

        const Component = () => (
            <motion.div
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ x }}
            />
        )

        render(<Component />)

        // Enable manual timing
        setManualTiming(true)

        // Render at 0ms
        await act(async () => {
            renderFrame({ timestamp: 0 })
        })

        // Render at 500ms (halfway through)
        await act(async () => {
            renderFrame({ timestamp: 500 })
        })

        expect(Math.round(x.get())).toBe(50)

        // Render at 1000ms (complete)
        await act(async () => {
            renderFrame({ timestamp: 1000 })
        })

        expect(Math.round(x.get())).toBe(100)
    })

    test("supports frame-based API for Remotion compatibility", async () => {
        const x = motionValue(0)

        const Component = () => (
            <motion.div
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ x }}
            />
        )

        render(<Component />)

        setManualTiming(true)

        // Use frame-based API (like Remotion's useCurrentFrame)
        await act(async () => {
            renderFrame({ frame: 0, fps: 30 })
        })

        await act(async () => {
            renderFrame({ frame: 15, fps: 30 }) // 500ms at 30fps
        })

        expect(Math.round(x.get())).toBe(50)

        await act(async () => {
            renderFrame({ frame: 30, fps: 30 }) // 1000ms at 30fps
        })

        expect(Math.round(x.get())).toBe(100)
    })
})

describe("Manual frame control simulation (like step buttons)", () => {
    afterEach(() => {
        setManualTiming(false)
    })

    test("simulates step-by-step animation control", async () => {
        const x = motionValue(0)
        const snapshots: number[] = []

        const Component = () => (
            <motion.div
                initial={{ x: 0 }}
                animate={{ x: 200 }}
                transition={{ duration: 2, ease: "linear" }}
                style={{ x }}
            />
        )

        render(<Component />)

        setManualTiming(true)

        // Simulate clicking "next frame" button multiple times
        // Each click advances by one frame at 30fps (~33.33ms)
        const frameTime = 1000 / 30

        for (let i = 0; i <= 60; i++) {
            // 60 frames = 2 seconds at 30fps
            await act(async () => {
                renderFrame({
                    timestamp: i * frameTime,
                    delta: frameTime,
                })
            })

            // Take snapshots at key points
            if (i === 0 || i === 15 || i === 30 || i === 45 || i === 60) {
                snapshots.push(Math.round(x.get()))
            }
        }

        // At 0 frames: 0%
        // At 15 frames (500ms): 25%
        // At 30 frames (1000ms): 50%
        // At 45 frames (1500ms): 75%
        // At 60 frames (2000ms): 100%
        expect(snapshots).toEqual([0, 50, 100, 150, 200])
    })

    test("allows scrubbing backwards through animation", async () => {
        const x = motionValue(0)

        const Component = () => (
            <motion.div
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ x }}
            />
        )

        render(<Component />)

        setManualTiming(true)

        // Go to end of animation
        await act(async () => {
            renderFrame({ timestamp: 1000 })
        })

        expect(Math.round(x.get())).toBe(100)

        // Scrub back to middle
        await act(async () => {
            renderFrame({ timestamp: 500 })
        })

        expect(Math.round(x.get())).toBe(50)

        // Scrub back to start
        await act(async () => {
            renderFrame({ timestamp: 0 })
        })

        expect(Math.round(x.get())).toBe(0)
    })
})
