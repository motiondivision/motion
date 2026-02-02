import { MotionGlobalConfig } from "motion-utils"
import { stepsOrder } from "./order"
import { createRenderStep } from "./render-step"
import { Batcher, FrameData, Process, Steps } from "./types"

const maxElapsed = 40

export function createRenderBatcher(
    scheduleNextBatch: (callback: Function) => void,
    allowKeepAlive: boolean
) {
    let runNextFrame = false
    let useDefaultElapsed = true

    const state: FrameData = {
        delta: 0.0,
        timestamp: 0.0,
        isProcessing: false,
    }

    const flagRunNextFrame = () => (runNextFrame = true)

    const steps = stepsOrder.reduce((acc, key) => {
        acc[key] = createRenderStep(
            flagRunNextFrame,
            allowKeepAlive ? key : undefined
        )
        return acc
    }, {} as Steps)

    const {
        setup,
        read,
        resolveKeyframes,
        preUpdate,
        update,
        preRender,
        render,
        postRender,
    } = steps

    const processBatch = () => {
        const timestamp = performance.now()
        runNextFrame = false

        state.delta = useDefaultElapsed
            ? 1000 / 60
            : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1)

        state.timestamp = timestamp
        state.isProcessing = true

        // Unrolled render loop for better per-frame performance
        setup.process(state)
        read.process(state)
        resolveKeyframes.process(state)
        preUpdate.process(state)
        update.process(state)
        preRender.process(state)
        render.process(state)
        postRender.process(state)

        state.isProcessing = false

        // Skip rAF scheduling when using a custom driver (e.g., Remotion)
        if (runNextFrame && allowKeepAlive && !MotionGlobalConfig.driver) {
            useDefaultElapsed = false
            scheduleNextBatch(processBatch)
        }
    }

    const wake = () => {
        runNextFrame = true
        useDefaultElapsed = true

        // Skip rAF scheduling when using a custom driver (e.g., Remotion)
        // In this case, processFrame() is called manually to advance animations
        if (!state.isProcessing && !MotionGlobalConfig.driver) {
            scheduleNextBatch(processBatch)
        }
    }

    /**
     * Manually process all scheduled frame callbacks.
     * Used for manual frame rendering in environments without requestAnimationFrame
     * (e.g., WebXR, Remotion, server-side rendering of videos).
     */
    const processFrame = (timestamp: number, delta?: number) => {
        runNextFrame = false

        state.delta = delta !== undefined ? delta : 1000 / 60
        state.timestamp = timestamp
        state.isProcessing = true

        // Unrolled render loop for better per-frame performance
        setup.process(state)
        read.process(state)
        resolveKeyframes.process(state)
        preUpdate.process(state)
        update.process(state)
        preRender.process(state)
        render.process(state)
        postRender.process(state)

        state.isProcessing = false
    }

    const schedule = stepsOrder.reduce((acc, key) => {
        const step = steps[key]
        acc[key] = (process: Process, keepAlive = false, immediate = false) => {
            if (!runNextFrame) wake()

            return step.schedule(process, keepAlive, immediate)
        }
        return acc
    }, {} as Batcher)

    const cancel = (process: Process) => {
        for (let i = 0; i < stepsOrder.length; i++) {
            steps[stepsOrder[i]].cancel(process)
        }
    }

    return { schedule, cancel, state, steps, processFrame }
}
