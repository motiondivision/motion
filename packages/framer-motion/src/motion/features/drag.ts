import { DragGesture } from "../../gestures/drag"
import { PanGesture } from "../../gestures/pan"
import { FeaturePackages } from "./types"

export const drag: FeaturePackages = {
    pan: {
        Feature: PanGesture,
    },
    drag: {
        Feature: DragGesture,
    },
}
