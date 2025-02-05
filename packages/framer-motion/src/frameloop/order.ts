import { StepId } from "./types"

export const stepsOrder: StepId[] = [
    "read", // Read
    "resolveKeyframes", // Write/Read/Write/Read
    "update", // Compute
    "preRender", // Compute
    "render", // Write
    "postRender", // Compute
] as const

export type StepNames = (typeof stepsOrder)[number]
