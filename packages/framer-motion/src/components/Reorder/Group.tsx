"use client"

import { invariant } from "motion-utils"
import * as React from "react"
import {
    forwardRef,
    FunctionComponent,
    JSX,
    useEffect,
    useRef,
    useState,
} from "react"
import { ReorderContext } from "../../context/ReorderContext"
import { motion } from "../../render/components/motion/proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import {
    DefaultGroupElement,
    ItemData,
    ReorderAxis,
    ReorderContextProps,
    ReorderElementTag,
} from "./types"
import { checkReorder } from "./utils/check-reorder"
import { detectAxis } from "./utils/detect-axis"

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
        ...props
    }: ReorderGroupProps<V, TagName>,
    externalRef?: React.ForwardedRef<any>
): JSX.Element {
    const Component = useConstant(
        () => motion[as as keyof typeof motion]
    ) as FunctionComponent<
        React.PropsWithChildren<HTMLMotionProps<any> & { ref?: React.Ref<any> }>
    >

    const itemLayouts = useRef(new Map<V, ItemData<V>["layout"]>())
    const [detectedAxis, setDetectedAxis] = useState<ReorderAxis>("y")
    const isReordering = useRef(false)
    const groupRef = useRef<Element>(null)
    const axis = axisOverride || detectedAxis

    invariant(
        Boolean(values),
        "Reorder.Group must be provided a values prop",
        "reorder-values"
    )

    const valuesSet = new Set(values)
    itemLayouts.current.forEach((_, value) => {
        if (!valuesSet.has(value)) itemLayouts.current.delete(value)
    })

    const context: ReorderContextProps<V> = {
        axis,
        groupRef,
        registerItem: (value, layout) => {
            itemLayouts.current.set(value, layout)

            if (!axisOverride) {
                const nextAxis = detectAxis(
                    values.flatMap((itemValue) => {
                        const itemLayout = itemLayouts.current.get(itemValue)
                        return itemLayout ? [itemLayout] : []
                    })
                )

                if (nextAxis !== detectedAxis) setDetectedAxis(nextAxis)
            }
        },
        updateOrder: (item, offset, velocity) => {
            if (isReordering.current) return

            const order = values.flatMap((value) => {
                const layout = itemLayouts.current.get(value)
                return layout ? [{ value, layout }] : []
            })
            const direction =
                groupRef.current?.ownerDocument.defaultView?.getComputedStyle(
                    groupRef.current
                ).direction === "rtl"
                    ? "rtl"
                    : "ltr"
            const newOrder = checkReorder(
                order,
                item,
                offset,
                velocity,
                axis,
                direction
            )

            if (order !== newOrder) {
                isReordering.current = true

                const newValues = [...values]
                const measuredIndexes = order.map(({ value }) =>
                    values.indexOf(value)
                )
                newOrder.forEach(({ value }, index) => {
                    newValues[measuredIndexes[index]] = value
                })
                onReorder(newValues)
            }
        },
    }

    useEffect(() => {
        isReordering.current = false
    })

    // Combine refs if external ref is provided
    const setRef = (element: Element | null) => {
        ;(groupRef as React.MutableRefObject<Element | null>).current = element
        if (typeof externalRef === "function") {
            externalRef(element)
        } else if (externalRef) {
            ;(externalRef as React.MutableRefObject<Element | null>).current =
                element
        }
    }

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
        <Component {...props} style={groupStyle} ref={setRef} ignoreStrict>
            <ReorderContext.Provider value={context}>
                {children}
            </ReorderContext.Provider>
        </Component>
    )
}

export const ReorderGroup = /*@__PURE__*/ forwardRef(ReorderGroupComponent) as <
    Values extends any[],
    TagName extends ReorderElementTag = DefaultGroupElement
>(
    props: Omit<
        ReorderGroupProps<Values[number], TagName>,
        "values" | "onReorder"
    > & {
        values: Values
        onReorder: (newOrder: Values) => void
    } & { ref?: React.ForwardedRef<any> }
) => ReturnType<typeof ReorderGroupComponent>
