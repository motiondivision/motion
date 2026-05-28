import { cancelFrame, frame, frameData } from "../frameloop"
import { activeAnimations } from "./animation-count"
import { ActiveStatsBuffer, statsBuffer } from "./buffer"
import { StatsSummary, Summary } from "./types"

function record() {
    const { value } = statsBuffer
    if (!value) return

    value.frameloop.rate.push(frameData.delta)
    value.animations.mainThread.push(activeAnimations.mainThread)
    value.animations.waapi.push(activeAnimations.waapi)
    value.animations.layout.push(activeAnimations.layout)
}

function summarise(values: number[]): Summary {
    const { length } = values
    if (length === 0) return { min: 0, max: 0, avg: 0 }

    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, v) => a + v, 0) / length,
    }
}

function summariseAll<T extends string>(
    obj: Record<T, number[]>
): Record<T, Summary> {
    const result = {} as Record<T, Summary>
    for (const key in obj) result[key] = summarise(obj[key])
    return result
}

function clearStatsBuffer() {
    statsBuffer.value = null
    statsBuffer.addProjectionMetrics = null
}

function reportStats(): StatsSummary {
    const { value } = statsBuffer

    if (!value) {
        throw new Error("Stats are not being measured")
    }

    clearStatsBuffer()
    cancelFrame(record)

    const summary = {
        frameloop: summariseAll(value.frameloop),
        animations: summariseAll(value.animations),
        layoutProjection: summariseAll(value.layoutProjection),
    }

    /**
     * Convert the rate to FPS. Min/max are swapped because the conversion inverts them.
     */
    const { rate } = summary.frameloop
    rate.avg = Math.round(1000 / rate.avg)
    const max = Math.round(1000 / rate.min)
    rate.min = Math.round(1000 / rate.max)
    rate.max = max

    return summary
}

export function recordStats() {
    if (statsBuffer.value) {
        clearStatsBuffer()
        throw new Error("Stats are already being measured")
    }

    const newStatsBuffer = statsBuffer as unknown as ActiveStatsBuffer

    newStatsBuffer.value = {
        frameloop: {
            setup: [],
            rate: [],
            read: [],
            resolveKeyframes: [],
            preUpdate: [],
            update: [],
            preRender: [],
            render: [],
            postRender: [],
        },
        animations: {
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

    newStatsBuffer.addProjectionMetrics = (metrics) => {
        const { layoutProjection } = newStatsBuffer.value
        layoutProjection.nodes.push(metrics.nodes)
        layoutProjection.calculatedTargetDeltas.push(
            metrics.calculatedTargetDeltas
        )
        layoutProjection.calculatedProjections.push(
            metrics.calculatedProjections
        )
    }

    frame.postRender(record, true)

    return reportStats
}
