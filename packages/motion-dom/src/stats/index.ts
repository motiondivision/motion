import { ActiveStatsBuffer, statsBuffer } from "./buffer"
import type { LayoutProjectionMetrics } from "./types"

/**
 * The metrics projection counts, in the order of the index it passes to
 * statsBuffer.countProjection.
 */
const projectionMetrics = [
    "nodes",
    "calculatedTargetDeltas",
    "calculatedProjections",
] as const

function clearStatsBuffer() {
    statsBuffer.value = null
    statsBuffer.addProjectionMetrics = null
    statsBuffer.countProjection = undefined
}

export function recordStats() {
    if (statsBuffer.value) {
        clearStatsBuffer()
        throw new Error("Stats are already being measured")
    }

    const buffer = statsBuffer as unknown as ActiveStatsBuffer

    buffer.value = {
        layoutProjection: {
            nodes: [],
            calculatedTargetDeltas: [],
            calculatedProjections: [],
        },
    }

    buffer.addProjectionMetrics = (metrics) => {
        const { layoutProjection } = buffer.value
        layoutProjection.nodes.push(metrics.nodes)
        layoutProjection.calculatedTargetDeltas.push(
            metrics.calculatedTargetDeltas
        )
        layoutProjection.calculatedProjections.push(
            metrics.calculatedProjections
        )
    }

    /**
     * Counting lives here rather than in projection, so bundles that never
     * call recordStats() don't ship it.
     */
    const metrics: LayoutProjectionMetrics = {
        nodes: 0,
        calculatedTargetDeltas: 0,
        calculatedProjections: 0,
    }

    buffer.countProjection = (metric) => {
        if (metric !== undefined) {
            metrics[projectionMetrics[metric]]++
        } else {
            buffer.addProjectionMetrics(metrics)
            metrics.nodes =
                metrics.calculatedTargetDeltas =
                metrics.calculatedProjections =
                    0
        }
    }
}
