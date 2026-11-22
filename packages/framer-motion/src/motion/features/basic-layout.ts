import { BasicHTMLProjectionNode } from "motion-dom"
import { MeasureBasicLayout } from "./layout/MeasureBasicLayout"
import { FeaturePackages } from "./types"

export const basicLayout: FeaturePackages = {
    layout: {
        ProjectionNode: BasicHTMLProjectionNode,
        MeasureLayout: MeasureBasicLayout,
    },
}
