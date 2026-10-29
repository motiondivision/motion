import {
    isMotionValue,
    motionValue,
    transformValue,
    visualElementStore,
    type MotionValue,
} from "motion-dom"
import type { Box, Point } from "motion-utils"
import { createElement, on, ref } from "remix/component"
import type { Handle, RemixNode } from "remix/component"
import type { ItemData, ReorderAxis } from "./components/Reorder/types"
import {
    autoScrollIfNeeded,
    resetAutoScrollState,
} from "./components/Reorder/utils/auto-scroll"
import {
    checkReorder,
    keyReorder,
} from "./components/Reorder/utils/check-reorder"
import { detectAxis } from "./components/Reorder/utils/detect-axis"
import type { MotionComponentProps } from "./remix"

export type ReorderGroupProps<V> = Omit<MotionComponentProps, "values"> & {
    /**
     * The element to render. Defaults to `"ul"`.
     */
    as?: string

    /**
     * The axis to reorder along. By default, this is detected from the item
     * layout. Use `"xy"` to explicitly enable wrapped layout reordering.
     */
    axis?: ReorderAxis

    /**
     * Called with the new order of `values`, and the value of the item
     * that moved, for each step of a drag.
     */
    onReorder: (newOrder: V[], moved: V) => void

    /**
     * The latest values, in order.
     */
    values: V[]
}

export type ReorderItemProps<V> = Omit<MotionComponentProps, "layout"> & {
    /**
     * The element to render. Defaults to `"li"`.
     */
    as?: string

    /**
     * The value in the group's `values` that this item represents.
     */
    value: V

    /**
     * Set to `"position"` to animate only the position of the item when
     * the order changes.
     *
     * @default true
     */
    layout?: true | "position"
}

type Grab = (element: Element, from?: any[]) => void

export interface ReorderContext {
    axis: ReorderAxis
    hasReordered: boolean
    getElement: () => Element | undefined
    registerItem: (value: any, layout: Box) => void
    updateOrder: (value: any, offset: Point, velocity: Point) => void
    onKeyDown: (
        event: KeyboardEvent,
        item: any,
        from: any[] | undefined,
        grab: Grab
    ) => void
}

const keys = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]

/**
 * Creates `Reorder.Group` and `Reorder.Item`, rendering the components of
 * `motion`.
 */
export interface ReorderComponents {
    Group: (
        handle: Handle<ReorderGroupProps<any>, ReorderContext>
    ) => () => RemixNode
    Item: (handle: Handle<ReorderItemProps<any>>) => () => RemixNode
}

export function createReorder(motion: any): ReorderComponents {
    /**
     * A list of items that can be reordered by drag or keyboard, with the
     * same props as React's `Reorder.Group`.
     */
    function Group(handle: Handle<ReorderGroupProps<any>, ReorderContext>) {
        const itemLayouts = new Map<any, Box>()
        let detectedAxis: ReorderAxis = "y"
        let isReordering = false
        let element: Element | undefined
        let renderedValues: any[] | undefined

        const getOrder = (): ItemData<any>[] =>
            handle.props.values.flatMap((value) => {
                const layout = itemLayouts.get(value)
                return layout ? [{ value, layout }] : []
            })

        const isRTL = () =>
            !!element && getComputedStyle(element).direction === "rtl"

        /**
         * Write the new order of the measured items back into the slots they
         * hold in `values`, leaving unmeasured values in place.
         */
        const commit = (newOrder: ItemData<any>[], moved: any) => {
            const { values, onReorder } = handle.props
            let i = 0
            const newValues = values.map((value) =>
                itemLayouts.has(value) ? newOrder[i++].value : value
            )
            newValues.some((value, j) => value !== values[j]) &&
                onReorder(newValues, moved)
        }

        const context: ReorderContext = {
            axis: "y",
            hasReordered: false,
            getElement: () => element,
            /**
             * Space grabs and drops the item, arrows along `axis` move the
             * grabbed item one place, or a row in a grid (see keyReorder),
             * and Escape restores the order in `from`, the values when it was
             * grabbed.
             */
            onKeyDown: (event, item, from, grab) => {
                const { key, currentTarget } = event
                if (
                    event.defaultPrevented ||
                    event.target !== currentTarget ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.metaKey
                ) {
                    return
                }

                const { axis } = context
                const order = getOrder()
                const keyIndex = keys.indexOf(key)
                const isX = keyIndex % 2
                if (key === " ") {
                    event.repeat ||
                        grab(
                            currentTarget as Element,
                            from ? undefined : handle.props.values
                        )
                } else if (!from) {
                    return
                } else if (key === "Escape") {
                    const kept = from.flatMap((value) =>
                        order.filter((data) => data.value === value)
                    )
                    commit(
                        order.map((data) =>
                            from.includes(data.value) ? kept.shift()! : data
                        ),
                        item
                    )
                    grab(currentTarget as Element)
                } else if (
                    keyIndex < 0 ||
                    (axis !== "xy" && axis !== (isX ? "x" : "y"))
                ) {
                    return
                } else {
                    commit(
                        keyReorder(
                            order,
                            item,
                            keyIndex,
                            axis,
                            !!isX && isRTL()
                        ),
                        item
                    )
                }
                event.preventDefault()
            },
            registerItem: (value, layout) => {
                itemLayouts.set(value, layout)

                if (!handle.props.axis) {
                    const nextAxis = detectAxis(
                        handle.props.values.flatMap((itemValue) => {
                            const itemLayout = itemLayouts.get(itemValue)
                            return itemLayout ? [itemLayout] : []
                        })
                    )

                    if (nextAxis !== detectedAxis) {
                        detectedAxis = nextAxis
                        handle.update()
                    }
                }
            },
            updateOrder: (item, offset, velocity) => {
                if (isReordering) return

                const order = getOrder()
                const newOrder = checkReorder(
                    order,
                    item,
                    offset,
                    velocity,
                    context.axis,
                    isRTL() ? "rtl" : "ltr"
                )

                if (order !== newOrder) {
                    isReordering = context.hasReordered = true
                    commit(newOrder, item)
                }
            },
        }

        return () => {
            const {
                as = "ul",
                axis,
                values,
                onReorder,
                style,
                mix,
                children,
                ...props
            } = handle.props

            const valuesSet = new Set(values)
            itemLayouts.forEach((_, value) => {
                if (!valuesSet.has(value)) itemLayouts.delete(value)
            })

            /**
             * Only allow the next reorder once the new order has rendered.
             */
            if (values !== renderedValues) {
                renderedValues = values
                handle.queueTask(() => (isReordering = false))
            }

            context.axis = axis || detectedAxis
            handle.context.set(context)

            return createElement(
                motion[as],
                {
                    ...props,
                    /**
                     * Scroll anchoring would move the page while items
                     * reorder, and with it the dragged item.
                     */
                    style: { overflowAnchor: "none", ...style },
                    mix: [
                        ref((node) => (element = node)),
                        /**
                         * The release that ends a reordering drag isn't a
                         * click. Clicks with no pointer press behind them
                         * (detail 0, e.g. keyboard) are left alone.
                         */
                        on<HTMLElement, "pointerdown">(
                            "pointerdown",
                            () => {
                                context.hasReordered = false
                            },
                            true
                        ),
                        on<HTMLElement, "click">(
                            "click",
                            (event) => {
                                if (context.hasReordered && event.detail) {
                                    context.hasReordered = false
                                    event.stopPropagation()
                                    event.preventDefault()
                                }
                            },
                            true
                        ),
                        mix,
                    ],
                },
                children
            )
        }
    }

    /**
     * An item in a `Reorder.Group`, with the same props as React's
     * `Reorder.Item`.
     */
    function Item(handle: Handle<ReorderItemProps<any>>) {
        /**
         * The group's values when this item was grabbed with the keyboard, for
         * Escape to restore. Set only while grabbed.
         */
        let grabbedFrom: any[] | undefined
        const defaultX = motionValue(0)
        const defaultY = motionValue(0)
        let zIndex: { x: MotionValue; y: MotionValue; value: MotionValue }

        const getGroup = () => handle.context.get(Group) as ReorderContext

        /**
         * A keyboard grab is a drag without a pointer, so it shares whileDrag.
         */
        const grab: Grab = (element, from) => {
            grabbedFrom = from
            visualElementStore
                .get(element)
                ?.animationState?.setActive("whileDrag", !!from)
        }

        return () => {
            const {
                as = "li",
                value,
                style = {},
                layout = true,
                onDrag,
                onDragEnd,
                mix,
                children,
                ...props
            } = handle.props
            const group = getGroup()
            const { axis } = group

            const x = isMotionValue(style.x) ? style.x : defaultX
            const y = isMotionValue(style.y) ? style.y : defaultY
            if (zIndex?.x !== x || zIndex.y !== y) {
                zIndex = {
                    x,
                    y,
                    value: transformValue(() =>
                        x.get() || y.get() ? 1 : "unset"
                    ),
                }
            }

            return createElement(
                motion[as],
                {
                    drag: axis === "xy" ? true : axis,
                    tabIndex: 0,
                    ...props,
                    dragSnapToOrigin: true,
                    style: { ...style, x, y, zIndex: zIndex.value },
                    layout,
                    onDrag: (event: PointerEvent, info: any) => {
                        const { velocity, point } = info
                        group.updateOrder(
                            handle.props.value,
                            { x: x.get(), y: y.get() },
                            velocity
                        )

                        const scrollAxis =
                            group.axis === "xy"
                                ? Math.abs(velocity.x) > Math.abs(velocity.y)
                                    ? "x"
                                    : "y"
                                : group.axis
                        autoScrollIfNeeded(
                            group.getElement() || null,
                            point[scrollAxis],
                            scrollAxis,
                            velocity[scrollAxis]
                        )

                        onDrag?.(event, info)
                    },
                    onDragEnd: (event: PointerEvent, info: any) => {
                        // Runs a frame after release, so after the release's click
                        group.hasReordered = false
                        resetAutoScrollState()
                        onDragEnd?.(event, info)
                    },
                    onLayoutMeasure: (measured: Box) =>
                        group.registerItem(handle.props.value, measured),
                    mix: [
                        mix,
                        on<HTMLElement, "keydown">("keydown", (event) =>
                            group.onKeyDown(
                                event,
                                handle.props.value,
                                grabbedFrom,
                                grab
                            )
                        ),
                        /**
                         * Remix blurs the item when it moves its node, and
                         * focuses it again in the same flush. So only drop
                         * it if focus is elsewhere once that's done.
                         */
                        on<HTMLElement, "blur">("blur", ({ currentTarget }) =>
                            queueMicrotask(
                                () =>
                                    grabbedFrom &&
                                    currentTarget.ownerDocument
                                        .activeElement !== currentTarget &&
                                    grab(currentTarget)
                            )
                        ),
                    ],
                },
                children
            )
        }
    }

    return { Group, Item }
}
