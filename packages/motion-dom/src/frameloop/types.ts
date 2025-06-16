export type Process = (data: FrameData) => void

export type Schedule = (
    process: Process,
    keepAlive?: boolean,
    immediate?: boolean
) => Process

export interface Step {
    schedule: Schedule
    cancel: (process: Process) => void
    process: (data: FrameData) => void
}

export type StepId =
    | "setup"
    | "read"
    | "resolveKeyframes"
    | "preUpdate"
    | "update"
    | "preRender"
    | "render"
    | "postRender"

export type CancelProcess = (process: Process) => void

export type Batcher = {
    [key in StepId]: Schedule
}

export type Steps = {
    [key in StepId]: Step
}

export interface FrameData {
    delta: number
    timestamp: number
    isProcessing: boolean
}
