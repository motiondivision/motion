"use client"

import { invariant } from "motion-utils"
import * as React from "react"
import { forwardRef, FunctionComponent, useEffect, useRef } from "react"
import type { HTMLElements } from "../../render/html/supported-elements"
import { ReorderContext } from "../../context/ReorderContext"
import { motion } from "../../render/components/motion/proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { ItemData, ReorderContextProps } from "./types"
import { checkReorder } from "./utils/check-reorder"

export interface Props<V> {
    /**
     * A HTML element to render this component as. Defaults to `"ul"`.
     *
     * @public
     */
    as?: keyof HTMLElements

    /**
     * The axis to reorder along. By default, items will be draggable on this axis.
     * To make draggable on both axes, set `<Reorder.Item drag />`
     *
     * @public
     */
    axis?: "x" | "y"

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
            if (idx !== -1) {
                order[idx].layout = layout[axis]
            } else {
                order.push({ value: value, layout: layout[axis] })
            }
            order.sort(compareMin)
        },
        updateOrder: (item, offset, velocity) => {
            if (isReordering.current) return

            const newOrder = checkReorder(order, item, offset, velocity)

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
    return a.layout.min - b.layout.min
}
