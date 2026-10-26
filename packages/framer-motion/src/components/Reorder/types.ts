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
    registerItem: (
        item: T,
        layout: Box,
        ref?: RefObject<Element | null>
    ) => void
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
    /**
     * Its element while it's mounted, for a `Reorder.Board`. A group keeps
     * the data of unmounted (e.g. virtualized) items while their values
     * remain, so not the element itself.
     */
    ref?: RefObject<Element | null>
}

type Group = ReorderContextProps<any>

/**
 * Lets the `Reorder.Group`s in a `Reorder.Board` move items between them.
 */
export interface ReorderBoardContextProps {
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
     * The drag or keyboard grab of `value` ended, so drop any move of it
     * that its new group hasn't picked up, e.g. because the groups refused
     * it.
     */
    end: (value: unknown) => void
    /**
     * Whether the item at `element` has moved to another group that hasn't
     * picked it up yet.
     */
    isMoving: (element: Element) => boolean
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
    /**
     * The outermost element around `group` that holds none of the other
     * groups, like its column. Dragging across groups scrolls the
     * containers around it, rather than the column.
     */
    column: (group: Group) => Element | null
}

// Reorder component type helpers
export type ReorderElementTag = keyof HTMLElements

// Default elements for each component
export type DefaultGroupElement = "ul"
export type DefaultItemElement = "li"
