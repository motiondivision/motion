"use client"

import { isMotionValue, visualElementStore } from "motion-dom"
import { invariant } from "motion-utils"
import * as React from "react"
import { forwardRef, FunctionComponent, useContext, useRef } from "react"
import { ReorderBoardContext } from "../../context/ReorderBoardContext"
import { ReorderContext } from "../../context/ReorderContext"
import type { MotionProxy } from "../../render/components/create-proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import { useMotionValue } from "../../value/use-motion-value"
import { useTransform } from "../../value/use-transform"

import { DefaultItemElement, Grab, ReorderElementTag } from "./types"
import { autoScrollIfNeeded, resetAutoScrollState } from "./utils/auto-scroll"
import { setRef } from "./utils/set-ref"

export interface Props<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
> {
    /**
     * A HTML element to render this component as. Defaults to `"li"`.
     *
     * @public
     */
    as?: TagName

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

type ReorderItemProps<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
> = Props<V, TagName> &
    Omit<HTMLMotionProps<TagName>, "value" | "layout"> &
    React.PropsWithChildren<{}>

export function ReorderItemComponent<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
>(
    {
        children,
        style = {},
        value,
        as = "li" as TagName,
        onDragStart,
        onDrag,
        onDragEnd,
        onKeyDown,
        onBlur,
        layout = true,
        ...props
    }: ReorderItemProps<V, TagName>,
    externalRef?: React.ForwardedRef<any>
): React.JSX.Element {
    const context = useContext(ReorderContext)
    const board = useContext(ReorderBoardContext)
    const ref = useRef<Element | null>(null)

    invariant(
        Boolean(context),
        "Reorder.Item must be a child of Reorder.Group",
        "reorder-item-child"
    )

    /**
     * Render the group's kind of component, `motion` or `m`.
     */
    const Component = useConstant(
        () => context!.proxy[as as keyof MotionProxy]
    ) as FunctionComponent<
        React.PropsWithChildren<HTMLMotionProps<any> & { ref?: React.Ref<any> }>
    >

    /**
     * The group's values when this item was grabbed with the keyboard, for
     * Escape to restore. Set only while grabbed. Only key and focus events
     * read it, so it's a ref: a key sent before React renders, as test
     * runners can, still sees the grab.
     */
    const grabbedFrom = useRef<V[]>()
    const point = {
        x: useDefaultMotionValue(style.x),
        y: useDefaultMotionValue(style.y),
    }

    const zIndex = useTransform([point.x, point.y], ([latestX, latestY]) =>
        latestX || latestY ? 1 : "unset"
    )

    const {
        axis,
        registerItem,
        updateOrder,
        groupRef,
        hasReordered,
        onKeyDown: handleKeyDown,
    } = context!
    /**
     * In a Reorder.Board, items can be dragged out of their group.
     */
    const dragAxis = axis === "xy" || board ? true : axis

    /**
     * A keyboard grab is a drag without a pointer, so it shares whileDrag
     * (but not the drag callbacks, which need a pointer and PanInfo).
     */
    const grab: Grab<V> = (element, from) => {
        grabbedFrom.current = from
        from || board?.end(value)
        visualElementStore
            .get(element)
            ?.animationState?.setActive("whileDrag", !!from)
    }

    /**
     * If this item was just moved here from another group, carry on its
     * drag or keyboard grab. A drag carried on is the same gesture, so it
     * doesn't call onDragStart again.
     */
    const isContinued = useRef(false)
    useIsomorphicLayoutEffect(() => {
        board?.receive(context!, value, ref.current!, grab) &&
            (isContinued.current = true)
    }, [])

    return (
        <Component
            drag={dragAxis}
            tabIndex={0}
            {...props}
            dragSnapToOrigin
            style={{ ...style, x: point.x, y: point.y, zIndex }}
            layout={layout}
            onDragStart={(event, gesturePoint) => {
                isContinued.current
                    ? (isContinued.current = false)
                    : onDragStart?.(event, gesturePoint)
            }}
            onDrag={(event, gesturePoint) => {
                const { velocity, point: pointerPoint } = gesturePoint
                const offset = { x: point.x.get(), y: point.y.get() }

                board?.drag(context!, value, ref.current!, event) ||
                    updateOrder(value, offset, velocity)

                /**
                 * In a Reorder.Board, scroll on both axes, e.g. across
                 * columns as well as down them. Across them, scroll what's
                 * around the columns: an item dragged out of its column
                 * overflows it, so the column could scroll across too.
                 */
                const scrollAxes: Array<"x" | "y"> = board
                    ? ["x", "y"]
                    : [
                          axis === "xy"
                              ? Math.abs(velocity.x) > Math.abs(velocity.y)
                                  ? "x"
                                  : "y"
                              : axis,
                      ]
                for (const scrollAxis of scrollAxes) {
                    autoScrollIfNeeded(
                        board && !axis.includes(scrollAxis)
                            ? board.column(context!)
                            : groupRef.current,
                        pointerPoint[scrollAxis],
                        scrollAxis,
                        velocity[scrollAxis]
                    )
                }

                onDrag && onDrag(event, gesturePoint)
            }}
            onDragEnd={(event, gesturePoint) => {
                // Runs a frame after release, so after the release's click
                hasReordered.current = false
                resetAutoScrollState()
                board?.end(value)
                onDragEnd && onDragEnd(event, gesturePoint)
            }}
            onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
                onKeyDown?.(event as any)
                handleKeyDown(event, value, grabbedFrom.current, grab)
            }}
            /**
             * A move blurs the item, but that blur is never dispatched:
             * React DOM disables its events while it commits, and restores
             * focus to the item before re-enabling them. So any blur that
             * reaches here is focus really leaving, which drops the item.
             */
            onBlur={(event: React.FocusEvent<HTMLElement>) => {
                onBlur?.(event as any)
                grabbedFrom.current && grab(event.currentTarget)
            }}
            onLayoutMeasure={(measured) => {
                registerItem(value, measured, ref)
            }}
            ref={(element: Element | null) => {
                ref.current = element
                return setRef(externalRef, element)
            }}
            ignoreStrict
        >
            {children}
        </Component>
    )
}

export const ReorderItem = /*@__PURE__*/ forwardRef(ReorderItemComponent) as <
    V,
    TagName extends ReorderElementTag = DefaultItemElement
>(
    props: ReorderItemProps<V, TagName> & { ref?: React.ForwardedRef<any> }
) => ReturnType<typeof ReorderItemComponent>
