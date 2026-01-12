import type { AnyResolvedKeyframe } from "../../animation/types"
import type { Box, Delta, Point } from "motion-utils"

/**
 * Minimal interface for projection node properties used by scale correctors.
 * This avoids circular dependencies with the full IProjectionNode interface.
 */
export interface ScaleCorrectionNode {
    target?: Box
    treeScale?: Point
    projectionDelta?: Delta
}

export type ScaleCorrector = (
    latest: AnyResolvedKeyframe,
    node: ScaleCorrectionNode
) => AnyResolvedKeyframe

export interface ScaleCorrectorDefinition {
    correct: ScaleCorrector
    applyTo?: string[]
    isCSSVariable?: boolean
}

export interface ScaleCorrectorMap {
    [key: string]: ScaleCorrectorDefinition
}
