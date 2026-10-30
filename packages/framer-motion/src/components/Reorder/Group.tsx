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
import { checkReorder, keyTarget } from "./utils/check-reorder"
import { detectAxis } from "./utils/detect-axis"
import { mergeRefs } from "./utils/merge-refs"

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
    const elements = useRef(new Map<V, { current: HTMLElement | null }>())
    const [active, setActive] = useState<V>()
    const [detectedAxis, setDetectedAxis] = useState<ReorderAxis>("y")
    const isReordering = useRef(false)
    const hasReordered = useRef(false)
    const groupRef = useRef<Element>(null)
    const axis = axisOverride || detectedAxis

    process.env.NODE_ENV !== "production" &&
        invariant(
            Boolean(values),
            "Reorder.Group must be provided a values prop",
            "reorder-values"
        )

    const valuesSet = new Set(values)
    for (const map of [items.current, elements.current]) {
        map.forEach((_, value) => valuesSet.has(value) || map.delete(value))
    }

    const tabStop = valuesSet.has(active!) ? active : values[0]
    const isRendered = (value?: V) =>
        elements.current.get(value!)?.current?.isConnected

    /**
     * Only values in `values` can be the tab stop.
     */
    const activate = (value: V) => valuesSet.has(value) && setActive(value)

    /**
     * If the tab stop isn't rendered (e.g. it's virtualized), the first
     * rendered item takes its place. Items check again when they unmount.
     */
    const checkTabStop = () => {
        isRendered(tabStop) || activate(values.find(isRendered)!)
    }
    useEffect(checkTabStop)

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
        isTabStop: (value) => value === tabStop || !valuesSet.has(value),
        setActive: activate,
        checkTabStop,
        elements: elements.current,
        /**
         * Space grabs and drops the item, arrows along `axis` move
         * the grabbed item one place, or a row in a grid (see keyTarget),
         * or move focus that way if it isn't grabbed, and Escape restores
         * the order in `from`, the values when it was grabbed. Keys from
         * children or with modifiers (Alt+Left etc.) are left alone.
         *
         * In a Reorder.Board, arrows across `axis`, or along it from either
         * end, move a grabbed item to the nearest group that way, and
         * Escape returns it to the group it was grabbed in.
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
            } else if (keyIndex < 0 && !(key === "Escape" && from)) {
                return
            } else if (board?.isMoving(currentTarget)) {
                /**
                 * Until React renders its move to another group, this item
                 * and its group's values are out of date: moving it again,
                 * or back, would leave it in both groups.
                 */
            } else if (key === "Escape" && from) {
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
            } else {
                const isAlongAxis = axis === "xy" || axis === (isX ? "x" : "y")
                /**
                 * Focus only moves between rendered items.
                 */
                const list = from
                    ? order
                    : order.filter(({ value }) => isRendered(value))
                const index = list.findIndex(({ value }) => value === item)
                const target = isAlongAxis
                    ? keyTarget(list, index, keyIndex, axis, !!isX && isRTL())
                    : -1
                if (target > -1) {
                    from
                        ? commit(moveItem(order, index, target), item)
                        : elements.current
                              .get(list[target].value)
                              ?.current?.focus()
                } else if (
                    !(
                        from &&
                        board?.key(context, item, keyIndex, currentTarget, from)
                    ) &&
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
            ref={mergeRefs(groupRef, externalRef)}
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
