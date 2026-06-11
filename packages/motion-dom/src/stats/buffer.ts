import type { LayoutProjectionMetrics, StatsRecording } from "./types"

export type InactiveStatsBuffer = {
    value: null
    addProjectionMetrics: null
}

export type ActiveStatsBuffer = {
    value: StatsRecording
    addProjectionMetrics: (metrics: LayoutProjectionMetrics) => void
}

export const statsBuffer: InactiveStatsBuffer | ActiveStatsBuffer = {
    value: null,
    addProjectionMetrics: null,
}
