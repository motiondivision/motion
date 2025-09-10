"use client"

import { isMotionValue } from "motion-dom"
import { invariant } from "motion-utils"
import * as React from "react"
import { forwardRef, useContext } from "react"
import { ReorderContext } from "../../context/ReorderContext"
import { motion } from "../../render/components/motion/proxy"
import { DOMMotionComponents } from "../../render/dom/types"
import { HTMLElements } from "../../render/html/supported-elements"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { useMotionValue } from "../../value/use-motion-value"
import { useTransform } from "../../value/use-transform"

export interface Props<V, Tag extends keyof DOMMotionComponents = "li"> {
    /**
     * A HTML element to render this component as. Defaults to `"li"`.
     *
     * @public
     */
    as?: Tag

    /**
     * The value in the list that this component represents.
     *
     * @public
     */
    value: V

    /**
     * A subset of layout options primarily used to disable layout="size"
     *
     * @public
     * @default true
     */
    layout?: true | "position"
}

function useDefaultMotionValue(value: any, defaultValue: number = 0) {
    return isMotionValue(value) ? value : useMotionValue(defaultValue)
}

type ReorderItemProps<V, Tag extends keyof DOMMotionComponents = "li"> = Props<V, Tag> &
    Omit<HTMLMotionProps<Tag extends keyof HTMLElements ? Tag : "div">, "value" | "layout"> &
    React.PropsWithChildren<{}>

export function ReorderItemComponent<V, Tag extends keyof DOMMotionComponents = "li">(
    {
        children,
        style = {},
        value,
        as = "li" as Tag,
        onDrag,
        layout = true,
        ...props
    }: ReorderItemProps<V, Tag>,
    externalRef?: React.ForwardedRef<HTMLElements[Tag extends keyof HTMLElements ? Tag : "div"]>
) {
    const Component = useConstant(() => motion[as]) as DOMMotionComponents[Tag]

    const context = useContext(ReorderContext)
    const point = {
        x: useDefaultMotionValue(style.x),
        y: useDefaultMotionValue(style.y),
    }

    const zIndex = useTransform([point.x, point.y], ([latestX, latestY]) =>
        latestX || latestY ? 1 : "unset"
    )

    invariant(
        Boolean(context),
        "Reorder.Item must be a child of Reorder.Group",
        "reorder-item-child"
    )

    const { axis, registerItem, updateOrder } = context!

    return (
        <Component
            drag={axis}
            {...props}
            dragSnapToOrigin
            style={{ ...style, x: point.x, y: point.y, zIndex }}
            layout={layout}
            onDrag={(event, gesturePoint) => {
                const { velocity } = gesturePoint
                velocity[axis] &&
                    updateOrder(value, point[axis].get(), velocity[axis])

                onDrag && onDrag(event, gesturePoint)
            }}
            onLayoutMeasure={(measured) => registerItem(value, measured)}
            ref={externalRef}
            ignoreStrict
        >
            {children}
        </Component>
    )
}

export const ReorderItem = /*@__PURE__*/ forwardRef(ReorderItemComponent) as <
    V,
    Tag extends keyof DOMMotionComponents = "li"
>(
    props: ReorderItemProps<V, Tag> & { ref?: React.ForwardedRef<HTMLElements[Tag extends keyof HTMLElements ? Tag : "div"]> }
) => ReturnType<typeof ReorderItemComponent>
