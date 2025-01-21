export interface Summary {
    min: number
    max: number
    avg: number
}

export interface Stats<T> {
    frameloop: {
        rate: T
        jobs: T
        readJobs: T
        updateJobs: T
        renderJobs: T
    }
    animations: {
        total: T
        mainThread: T
        waapi: T
        layout: T
    }
    layoutProjection: {
        nodes: T
        calculatedTargetDeltas: T
        calculatedProjections: T
    }
}

export type FrameStats = Stats<number>

export type StatsBuffer = FrameStats[]

export type StatsSummary = Stats<Summary>
