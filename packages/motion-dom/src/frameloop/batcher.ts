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
        const timestamp = MotionGlobalConfig.useManualTiming
            ? state.timestamp
            : performance.now()
        runNextFrame = false

        if (!MotionGlobalConfig.useManualTiming) {
            state.delta = useDefaultElapsed
                ? 1000 / 60
                : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1)
        }

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

        if (runNextFrame && allowKeepAlive) {
            useDefaultElapsed = false
            scheduleNextBatch(processBatch)
        }
    }

    const wake = () => {
        runNextFrame = true
        useDefaultElapsed = true

        if (!state.isProcessing) {
            scheduleNextBatch(processBatch)
        }
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

    return { schedule, cancel, state, steps }
}
