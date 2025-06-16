import { StepId } from "./types"

export const stepsOrder: StepId[] = [
    "setup", // Compute
    "read", // Read
    "resolveKeyframes", // Write/Read/Write/Read
    "preUpdate", // Compute
    "update", // Compute
    "preRender", // Compute
    "render", // Write
    "postRender", // Compute
] as const

export type StepNames = (typeof stepsOrder)[number]
