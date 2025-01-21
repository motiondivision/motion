import { cancelFrame, frame, frameData } from "../frameloop"
import { statsBuffer } from "./buffer"
import { StatsSummary, Summary } from "./types"

// TODO:
// - Convert MotionDebug to use stats
// - Start tracking animations
// - Add tests for stats

function recordFrameRate() {
    statsBuffer.value?.frameloop.rate.push(frameData.delta)
}

function mean(values: number[]) {
    return values.reduce((acc, value) => acc + value, 0) / values.length
}

function harmonicMean(values: number[]) {
    return values.length / values.reduce((acc, value) => acc + 1 / value, 0)
}

function summarise(
    values: number[],
    calcAverage: (allValues: number[]) => number = mean
): Summary {
    if (values.length === 0) {
        return {
            min: 0,
            max: 0,
            avg: 0,
        }
    }

    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: Math.round(calcAverage(values)),
    }
}

const msToFps = (ms: number) => Math.round(1000 / ms)

function reportStats(): StatsSummary {
    const { value } = statsBuffer

    if (!value) {
        throw new Error("Stats are not being measured")
    }

    statsBuffer.value = null
    cancelFrame(recordFrameRate)

    const summary = {
        frameloop: {
            rate: summarise(value.frameloop.rate.map(msToFps), harmonicMean),
            read: summarise(value.frameloop.read),
            resolveKeyframes: summarise(value.frameloop.resolveKeyframes),
            update: summarise(value.frameloop.update),
            preRender: summarise(value.frameloop.preRender),
            render: summarise(value.frameloop.render),
            postRender: summarise(value.frameloop.postRender),
        },
        animations: {
            total: summarise(value.animations.total),
            mainThread: summarise(value.animations.mainThread),
            waapi: summarise(value.animations.waapi),
            layout: summarise(value.animations.layout),
        },
        layoutProjection: {
            nodes: summarise(value.layoutProjection.nodes),
            calculatedTargetDeltas: summarise(
                value.layoutProjection.calculatedTargetDeltas
            ),
            calculatedProjections: summarise(
                value.layoutProjection.calculatedProjections
            ),
        },
    }

    return summary
}

export function measureStats() {
    if (statsBuffer.value) {
        statsBuffer.value = null
        throw new Error("Stats are already being measured")
    }

    statsBuffer.value = {
        frameloop: {
            rate: [],
            read: [],
            resolveKeyframes: [],
            update: [],
            preRender: [],
            render: [],
            postRender: [],
        },
        animations: {
            total: [],
            mainThread: [],
            waapi: [],
            layout: [],
        },
        layoutProjection: {
            nodes: [],
            calculatedTargetDeltas: [],
            calculatedProjections: [],
        },
    }

    frame.postRender(recordFrameRate, true)

    return reportStats
}
