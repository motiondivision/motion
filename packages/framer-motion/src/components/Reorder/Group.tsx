"use client"

import { invariant } from "motion-utils"
import * as React from "react"
import { forwardRef, FunctionComponent, useEffect, useRef } from "react"
import type { HTMLElements } from "../../render/html/supported-elements"
import { ReorderContext } from "../../context/ReorderContext"
import { motion } from "../../render/components/motion/proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { ItemData, ReorderContextProps, Point } from "./types"
import { checkReorder } from "./utils/check-reorder"

export interface Props<V> {
    /**
     * A HTML element to render this component as. Defaults to `"ul"`.
     *
     * @public
     */
    as?: keyof HTMLElements

    /**
     * The axis to reorder along. Can be `"x"`, `"y"`, or `"xy"`.
     * - `"x"`: Items are draggable horizontally.
     * - `"y"`: Items are draggable vertically.
     * - `"xy"`: Items are draggable in both x and y directions, suitable for grid layouts.
     *   When `axis` is `"xy"`, `<Reorder.Item>` components are draggable on both axes by default.
     *
     * @public
     */
    axis?: "x" | "y" | "xy"

    /**
     * A callback to fire with the new value order. For instance, if the values
     * are provided as a state from `useState`, this could be the set state function.
     *
     * @public
     */
    onReorder: (newOrder: V[]) => void

    /**
     * The latest values state.
     *
     * ```jsx
     * function Component() {
     *   const [items, setItems] = useState([0, 1, 2])
     *
     *   return (
     *     <Reorder.Group values={items} onReorder={setItems}>
     *         {items.map((item) => <Reorder.Item key={item} value={item} />)}
     *     </Reorder.Group>
     *   )
     * }
     * ```
     *
     * @public
     */
    values: V[]
}

type ReorderGroupProps<V> = Props<V> &
    Omit<HTMLMotionProps<any>, "values"> &
    React.PropsWithChildren<{}>

export function ReorderGroupComponent<V>(
    {
        children,
        as = "ul",
        axis = "y",
        onReorder,
        values,
        ...props
    }: ReorderGroupProps<V>,
    externalRef?: React.ForwardedRef<any>
) {
    const Component = useConstant(
        () => motion[as as keyof typeof motion]
    ) as FunctionComponent<
        React.PropsWithChildren<HTMLMotionProps<any> & { ref?: React.Ref<any> }>
    >

    const order: ItemData<V>[] = []
    const isReordering = useRef(false)

    invariant(Boolean(values), "Reorder.Group must be provided a values prop")

    const context: ReorderContextProps<V> = {
        axis,
        registerItem: (value, layout) => {
            // If the entry was already added, update it rather than adding it again
            const idx = order.findIndex((entry) => value === entry.value)
            if (axis === "xy") {
                if (idx !== -1) {
                    order[idx].layout = layout
                } else {
                    order.push({ value: value, layout: layout })
                }
            } else {
                if (idx !== -1) {
                    order[idx].layout = layout[axis]
                } else {
                    order.push({ value: value, layout: layout[axis] })
                }
            }
            order.sort(compareMin)
        },
        updateOrder: (item, offset: Point, velocity: Point) => {
            if (isReordering.current) return

            const newOrder = checkReorder(order, item, offset, velocity, axis)

            if (order !== newOrder) {
                isReordering.current = true
                onReorder(
                    newOrder
                        .map(getValue)
                        .filter((value) => values.indexOf(value) !== -1)
                )
            }
        },
    }

    useEffect(() => {
        isReordering.current = false
    })

    return (
        <Component {...props} ref={externalRef} ignoreStrict>
            <ReorderContext.Provider value={context}>
                {children}
            </ReorderContext.Provider>
        </Component>
    )
}

export const ReorderGroup = /*@__PURE__*/ forwardRef(ReorderGroupComponent) as <
    V
>(
    props: ReorderGroupProps<V> & { ref?: React.ForwardedRef<any> }
) => ReturnType<typeof ReorderGroupComponent>

function getValue<V>(item: ItemData<V>) {
    return item.value
}

function compareMin<V>(a: ItemData<V>, b: ItemData<V>) {
    // Check if layout is an Axis object (has 'min' directly)
    // We need to cast to <any> first because TS doesn't know if 'min' exists on Axis | Box
    if ("min" in (a.layout as any) && "min" in (b.layout as any)) {
        return ((a.layout as any).min - (b.layout as any).min) as number
    }
    // Otherwise, assume Box object
    else {
        const aLayout = a.layout as import("motion-utils").Box
        const bLayout = b.layout as import("motion-utils").Box
        const xDiff = aLayout.x.min - bLayout.x.min
        if (xDiff !== 0) {
            return xDiff
        }
        return aLayout.y.min - bLayout.y.min
    }
}
