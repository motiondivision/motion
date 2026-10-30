import { Box, Point } from "motion-utils"
import { KeyboardEvent, RefObject } from "react"
import type { MotionProxy } from "../../render/components/create-proxy"
import { HTMLElements } from "../../render/html/supported-elements"

export type ReorderAxis = "x" | "y" | "xy"

export interface ReorderContextProps<T> {
    axis: ReorderAxis
    /**
     * The group's `motion` or `m`, for its items to render.
     */
    proxy: MotionProxy
    registerItem: (item: T, layout: Box) => void
    updateOrder: (item: T, offset: Point, velocity: Point) => void
    groupRef: RefObject<Element | null>
    hasReordered: { current: boolean }
    /**
     * Whether an item is in the tab order. Only one in `values` is: the
     * last focused, or the first rendered.
     */
    isTabStop: (item: T) => boolean
    setActive: (item: T) => void
    /**
     * Each item's element, for arrow keys to focus.
     */
    elements: Map<T, { current: HTMLElement | null }>
    onKeyDown: (
        event: KeyboardEvent<Element>,
        item: T,
        from: T[] | undefined,
        grab: (element: Element, from?: T[]) => void
    ) => void
}

export interface ItemData<T> {
    value: T
    layout: Box
}

// Reorder component type helpers
export type ReorderElementTag = keyof HTMLElements

// Default elements for each component
export type DefaultGroupElement = "ul"
export type DefaultItemElement = "li"
