import { IProjectionNode } from "../node/types"

export type ScaleCorrector = (
    latest: string | number,
    node: IProjectionNode
) => string | number

export interface ScaleCorrectorDefinition {
    correct: ScaleCorrector
    applyTo?: string[]
    isCSSVariable?: boolean
}

export interface ScaleCorrectorMap {
    [key: string]: ScaleCorrectorDefinition
}
