import type { LayoutProjectionMetrics, StatsRecording } from "./types"

export type InactiveStatsBuffer = {
    value: null
    addProjectionMetrics: null
    countProjection?: undefined
}

export type ActiveStatsBuffer = {
    value: StatsRecording
    addProjectionMetrics: (metrics: LayoutProjectionMetrics) => void
    /**
     * Counts one projection metric, by its index in recordStats()'s
     * projectionMetrics.
     * Called without one at the end of a projection frame, it records the
     * frame's counts and starts the next.
     */
    countProjection: (metric?: number) => void
}

export const statsBuffer: InactiveStatsBuffer | ActiveStatsBuffer = {
    value: null,
    addProjectionMetrics: null,
    countProjection: undefined,
}
