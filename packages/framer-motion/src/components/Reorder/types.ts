import { Axis, Box } from "motion-utils"

export interface ReorderContextProps<T> {
    axis: "x" | "y"
    registerItem: (item: T, layout: Box) => void
    updateOrder: (item: T, offset: number, velocity: number) => void
}

export interface ItemData<T> {
    value: T
    layout: Axis
}
