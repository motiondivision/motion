import { Axis, Box } from "motion-utils"
import { RefObject } from "react"
import { HTMLElements } from "../../render/html/supported-elements"

export interface ReorderContextProps<T> {
    axis: "x" | "y"
    registerItem: (item: T, layout: Box) => void
    updateOrder: (item: T, offset: number, velocity: number) => void
    groupRef: RefObject<Element | null>
}

export interface ItemData<T> {
    value: T
    layout: Axis
}

// Reorder component type helpers
export type ReorderElementTag = keyof HTMLElements

// Default elements for each component
export type DefaultGroupElement = "ul"
export type DefaultItemElement = "li"
