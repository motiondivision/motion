"use client"

import { invariant, moveItem } from "motion-utils"
import * as React from "react"
import {
    forwardRef,
    FunctionComponent,
    JSX,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { ReorderBoardContext } from "../../context/ReorderBoardContext"
import { ReorderContext } from "../../context/ReorderContext"
import type { MotionProxy } from "../../render/components/create-proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import {
    DefaultGroupElement,
    ItemData,
    ReorderAxis,
    ReorderContextProps,
    ReorderElementTag,
} from "./types"
import { checkReorder } from "./utils/check-reorder"
import { detectAxis } from "./utils/detect-axis"
import { setRef } from "./utils/set-ref"

export interface Props<
    V,
    TagName extends ReorderElementTag = DefaultGroupElement
> {
    /**
     * A HTML element to render this component as. Defaults to `"ul"`.
     *
     * @public
     */
    as?: TagName

    /**
     * The axis to reorder along. By default, this is detected from the item
     * layout. Use `"xy"` to explicitly enable wrapped layout reordering.
     *
     * @public
     */
    axis?: ReorderAxis

    /**
     * A callback to fire with the new value order. For instance, if the values
     * are provided as a state from `useState`, this could be the set state function.
     *
     * The second argument is the value of the item that moved. Its old and
     * new positions are `values.indexOf(moved)` and `newOrder.indexOf(moved)`.
     * This fires for each step of a drag, not once when it ends, so these
     * describe that step's move.
     *
     * @public
     */
    onReorder: (newOrder: V[], moved: V) => void

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

type ReorderGroupProps<
    V,
    TagName extends ReorderElementTag = DefaultGroupElement
> = Props<V, TagName> &
    Omit<HTMLMotionProps<TagName>, "values"> &
    React.PropsWithChildren<{}>

export function ReorderGroupComponent<
    V,
    TagName extends ReorderElementTag = DefaultGroupElement
>(
    {
        children,
        as = "ul" as TagName,
        axis: axisOverride,
        onReorder,
        values,
        onPointerDownCapture,
        onClickCapture,
        ...props
    }: ReorderGroupProps<V, TagName>,
    externalRef: React.ForwardedRef<any>,
    proxy: MotionProxy
): JSX.Element {
    const Component = useConstant(
        () => proxy[as as keyof MotionProxy]
    ) as FunctionComponent<
        React.PropsWithChildren<HTMLMotionProps<any> & { ref?: React.Ref<any> }>
    >

    const board = useContext(ReorderBoardContext)
    const items = useRef(new Map<V, ItemData<V>>())
    const [detectedAxis, setDetectedAxis] = useState<ReorderAxis>("y")
    const isReordering = useRef(false)
    const hasReordered = useRef(false)
    const groupRef = useRef<Element>(null)
    const axis = axisOverride || detectedAxis

    invariant(
        Boolean(values),
        "Reorder.Group must be provided a values prop",
        "reorder-values"
    )

    const valuesSet = new Set(values)
    items.current.forEach((_, value) => {
        if (!valuesSet.has(value)) items.current.delete(value)
    })

    const getOrder = () =>
        values.flatMap((value) => items.current.get(value) || [])

    const isRTL = () =>
        groupRef.current?.ownerDocument.defaultView?.getComputedStyle(
            groupRef.current
        ).direction === "rtl"

    /**
     * Write the new order of the measured items back into the slots they
     * hold in `values`, leaving unmeasured (e.g. virtualized) values in place.
     */
    const commit = (newOrder: ItemData<V>[], moved: V) => {
        let i = 0
        const newValues = values.map((value) =>
            items.current.has(value) ? newOrder[i++].value : value
        )
        newValues.some((value, j) => value !== values[j]) &&
            onReorder(newValues, moved)
    }

    const context: ReorderContextProps<V> = {
        axis,
        proxy,
        groupRef,
        hasReordered,
        values,
        onReorder,
        getOrder,
        /**
         * Space grabs and drops the item, arrows along `axis` move
         * the grabbed item one place (Left and Right swap in RTL) and Escape
         * restores the order in `from`, the values when it was grabbed. Keys
         * from children or with modifiers (Alt+Left etc.) are left alone.
         *
         * In a Reorder.Board, arrows across `axis`, or along it from either
         * end, move the item to the nearest group that way, and Escape
         * returns it to the group it was grabbed in.
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

            const order = getOrder()
            const keyIndex = [
                "ArrowUp",
                "ArrowLeft",
                "ArrowDown",
                "ArrowRight",
            ].indexOf(key)
            const isX = keyIndex % 2
            if (key === " ") {
                event.repeat || grab(currentTarget, from ? undefined : values)
            } else if (!from) {
                return
            } else if (key === "Escape") {
                /**
                 * Drop it first: a move back to the group it was grabbed in
                 * hands it on to the item that mounts there.
                 */
                grab(currentTarget)
                if (!board?.restore(context, item, currentTarget, from)) {
                    /**
                     * Values added since the grab keep their slots.
                     */
                    const kept = from.flatMap((value) =>
                        order.filter((data) => data.value === value)
                    )
                    commit(
                        order.map((data) =>
                            from.includes(data.value) ? kept.shift()! : data
                        ),
                        item
                    )
                }
            } else if (keyIndex < 0) {
                return
            } else {
                const isAlongAxis = axis === "xy" || axis === (isX ? "x" : "y")
                const index = order.findIndex(({ value }) => value === item)
                const target =
                    index + (keyIndex > 1 !== !!(isX && isRTL()) ? 1 : -1)

                if (isAlongAxis && index > -1 && order[target]) {
                    commit(moveItem(order, index, target), item)
                } else if (
                    !board?.key(context, item, keyIndex, currentTarget, from) &&
                    !isAlongAxis
                ) {
                    return
                }
            }
            event.preventDefault()
        },
        registerItem: (value, layout, ref) => {
            items.current.set(value, { value, layout, ref })

            if (!axisOverride) {
                const nextAxis = detectAxis(
                    getOrder().map((data) => data.layout)
                )

                if (nextAxis !== detectedAxis) setDetectedAxis(nextAxis)
            }
        },
        updateOrder: (item, offset, velocity) => {
            if (isReordering.current) return

            const order = getOrder()
            const newOrder = checkReorder(
                order,
                item,
                offset,
                velocity,
                axis,
                isRTL() ? "rtl" : "ltr"
            )

            if (order !== newOrder) {
                isReordering.current = true
                hasReordered.current = true
                commit(newOrder, item)
            }
        },
    }

    /**
     * Only clear the guard once the new order has been rendered. Unrelated
     * commits (useTransition's isPending, stale renders in front of
     * useDeferredValue) would otherwise re-enable onReorder while the
     * previous order is still pending.
     */
    useEffect(() => {
        isReordering.current = false
    }, [values])

    /**
     * Keep a Reorder.Board up to date with the committed values.
     */
    useIsomorphicLayoutEffect(() => board?.add(context))

    /**
     * Disable browser scroll anchoring on the group container.
     * When items reorder, scroll anchoring can cause the browser to adjust
     * the scroll position, which interferes with drag position calculations.
     */
    const groupStyle = {
        overflowAnchor: "none" as const,
        ...props.style,
    }

    return (
        <Component
            {...props}
            style={groupStyle}
            ref={(element: Element | null) => {
                setRef(groupRef, element)
                return setRef(externalRef, element)
            }}
            /**
             * A release that ends a reordering drag isn't a click. Browsers
             * only click an element holding both the press and release
             * targets, so whether it was clicked depended on which nodes
             * React moved, and so on drag direction (#2682): Chrome drops
             * the click if the dragged item's node moved, others may click
             * an ancestor. Swallow it here, above every item, either way.
             * The flag is cleared when the drag ends, a frame after the
             * release's click, or on the next press. Clicks with no
             * pointer press behind them (detail 0, e.g. keyboard) are left
             * alone.
             */
            onPointerDownCapture={(event: React.PointerEvent<any>) => {
                hasReordered.current = false
                onPointerDownCapture?.(event)
            }}
            onClickCapture={(event: React.MouseEvent<any>) => {
                if (hasReordered.current && event.detail) {
                    hasReordered.current = false
                    event.stopPropagation()
                    event.preventDefault()
                }
                onClickCapture?.(event)
            }}
            ignoreStrict
        >
            <ReorderContext.Provider value={context}>
                {children}
            </ReorderContext.Provider>
        </Component>
    )
}

/**
 * Creates `Reorder.Group` rendering the components of `proxy`: `motion`,
 * or `m` to get its features from `LazyMotion`. Its items render the same.
 */
export const createReorderGroup = (proxy: MotionProxy) =>
    forwardRef((props: ReorderGroupProps<any, any>, ref) =>
        ReorderGroupComponent(props, ref, proxy)
    ) as <
        Values extends any[],
        TagName extends ReorderElementTag = DefaultGroupElement
    >(
        props: Omit<
            ReorderGroupProps<Values[number], TagName>,
            "values" | "onReorder"
        > & {
            values: Values
            onReorder: (newOrder: Values, moved: Values[number]) => void
        } & { ref?: React.ForwardedRef<any> }
    ) => ReturnType<typeof ReorderGroupComponent>
