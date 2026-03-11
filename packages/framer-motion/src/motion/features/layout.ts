import { HTMLProjectionNode } from "motion-dom"
import { MeasureLayout } from "./layout/MeasureLayout"
import { FeaturePackages } from "./types"

export const layout: FeaturePackages = {
    layout: {
        ProjectionNode: HTMLProjectionNode,
        MeasureLayout,
    },
}
