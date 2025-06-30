import { Axis, Box } from "motion-utils"

export interface ReorderContextProps<T> {
    axis: "x" | "y" | "xy"
    registerItem: (item: T, layout: Box) => void
    updateOrder: (item: T, offset: Point, velocity: Point) => void
}

export interface Point {
    x: number
    y: number
}

export interface ItemData<T> {
    value: T
    layout: Axis | Box
}
