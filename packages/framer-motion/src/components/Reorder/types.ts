import { Box, Point } from "motion-utils"
import { KeyboardEvent, RefObject } from "react"
import type { MotionProxy } from "../../render/components/create-proxy"
import { HTMLElements } from "../../render/html/supported-elements"

export type ReorderAxis = "x" | "y" | "xy"

export type Grab<T> = (element: Element, from?: T[]) => void

export interface ReorderContextProps<T> {
    axis: ReorderAxis
    /**
     * The group's `motion` or `m`, for its items to render.
     */
    proxy: MotionProxy
    registerItem: (item: T, layout: Box, element?: Element) => void
    updateOrder: (item: T, offset: Point, velocity: Point) => void
    groupRef: RefObject<Element | null>
    hasReordered: { current: boolean }
    onKeyDown: (
        event: KeyboardEvent<Element>,
        item: T,
        from: T[] | undefined,
        grab: Grab<T>
    ) => void
    /**
     * The group's latest props and measured items, for a `Reorder.Board`
     * to move items between groups.
     */
    values: T[]
    onReorder: (newOrder: T[], moved: T) => void
    getOrder: () => ItemData<T>[]
}

export interface ItemData<T> {
    value: T
    layout: Box
    element?: Element
}

type Group = ReorderContextProps<any>

/**
 * Lets the `Reorder.Group`s in a `Reorder.Board` move items between them.
 */
export interface ReorderBoardProps {
    /**
     * Register a group's latest context. Returns a function to remove it.
     */
    add: (group: Group) => VoidFunction
    /**
     * Move an item being dragged into the group under its centre. Returns
     * whether it moved, or is moving, so `group` shouldn't reorder it too.
     */
    drag: (
        group: Group,
        value: unknown,
        element: Element,
        event: MouseEvent | TouchEvent | PointerEvent
    ) => boolean
    /**
     * Move a grabbed item to the nearest group in the direction of the
     * arrow key at `keyIndex` (up, left, down, right). Returns whether it
     * moved.
     */
    key: (
        group: Group,
        value: unknown,
        keyIndex: number,
        element: Element,
        from: unknown[]
    ) => boolean
    /**
     * Move a grabbed item back to the group it was grabbed in, if it's
     * since been moved to another. Returns whether it moved.
     */
    restore: (
        group: Group,
        value: unknown,
        element: Element,
        from: unknown[]
    ) => boolean
    /**
     * Called by a mounting item, to continue the drag or keyboard grab
     * that moved it here from another group. Returns whether it continues
     * a drag, whose onDragStart has already been called.
     */
    receive: (
        group: Group,
        value: unknown,
        element: Element,
        grab: Grab<any>
    ) => boolean
}

// Reorder component type helpers
export type ReorderElementTag = keyof HTMLElements

// Default elements for each component
export type DefaultGroupElement = "ul"
export type DefaultItemElement = "li"
