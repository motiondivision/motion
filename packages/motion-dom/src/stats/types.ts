export interface LayoutProjectionMetrics {
    nodes: number
    calculatedTargetDeltas: number
    calculatedProjections: number
}

export interface LayoutProjectionStats {
    nodes: number[]
    calculatedTargetDeltas: number[]
    calculatedProjections: number[]
}

export interface StatsRecording {
    layoutProjection: LayoutProjectionStats
}
