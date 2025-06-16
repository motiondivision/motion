export interface Point {
    x: number
    y: number
}

export interface Axis {
    min: number
    max: number
}

export interface Box {
    x: Axis
    y: Axis
}

export interface BoundingBox {
    top: number
    right: number
    bottom: number
    left: number
}

export interface AxisDelta {
    translate: number
    scale: number
    origin: number
    originPoint: number
}

export interface Delta {
    x: AxisDelta
    y: AxisDelta
}

export type TransformPoint = (point: Point) => Point
